'use strict';

const repo = require('./repository');
const { query, beginTransaction } = require('../../config/db');
const { generateDocNumber } = require('../../utils/docNumber');
const { postStockMovement } = require('../../utils/stockHelper');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../../middlewares/error.middleware');

const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const getById = async (id, tenantId) => {
  const dc = await repo.findById(id, tenantId);
  if (!dc) throw new AppError('Delivery challan not found', 404, 'NOT_FOUND');

  const items = await repo.findItemsByChallanId(id, tenantId);
  return { ...dc, items };
};

const createFromPickList = async (pickListId, tenantId, userId, body = {}) => {

  const pickRows = await query(`
    SELECT pl.*, so.so_number, so.customer_id, so.warehouse_id
    FROM pick_lists pl
    JOIN sales_orders so ON pl.sales_order_id = so.id AND so.tenant_id = pl.tenant_id
    WHERE pl.id = ? AND pl.tenant_id = ?
  `,[pickListId, tenantId]);

  if (!pickRows || pickRows.length === 0) {
    throw new AppError('Pick list not found',404,'NOT_FOUND');
  }

  const pick = pickRows[0];

  // ISSUE-4 FIX: Prevent duplicate DC for same pick list
  const existingDC = await query(
    'SELECT id FROM delivery_challans WHERE pick_list_id = ? AND tenant_id = ? LIMIT 1',
    [pickListId, tenantId]
  );
  if (existingDC.length > 0) {
    return getById(existingDC[0].id, tenantId);
  }

  if (pick.status !== 'completed') {
    throw new AppError('Only completed pick lists can be used to create delivery challan',400,'INVALID_STATUS');
  }

  const items = await query(`
    SELECT pli.*, p.sqft_per_box
    FROM pick_list_items pli
    JOIN products p ON pli.product_id = p.id
    WHERE pli.pick_list_id = ? AND pli.tenant_id = ? AND pli.picked_boxes > 0
  `,[pickListId, tenantId]);

  if (!items.length) {
    throw new AppError('Pick list has no picked items',400,'NO_ITEMS');
  }

  const soItemPrices = await query(`
    SELECT product_id, shade_id, unit_price
    FROM sales_order_items
    WHERE sales_order_id = ? AND tenant_id = ?
  `,[pick.sales_order_id, tenantId]);

  const priceMap = new Map();
  soItemPrices.forEach(r => {
    priceMap.set(`${r.product_id}_${r.shade_id || ''}`, r.unit_price);
  });

  const dcNumber = await generateDocNumber(tenantId,'DC','DC');
  const id = uuidv4();

  const trx = await beginTransaction();

  try {

    await repo.create(trx,{
      id,
      tenant_id: tenantId,
      dc_number: dcNumber,
      sales_order_id: pick.sales_order_id,
      pick_list_id: pickListId,
      customer_id: pick.customer_id,
      warehouse_id: pick.warehouse_id, // FIX ADDED
      dispatch_date: body.dispatch_date || new Date(),
      vehicle_number: body.vehicle_number || null,
      transporter_name: body.transporter_name || null,
      lr_number: body.lr_number || null,
      created_by: userId
    });

    for(const it of items){

      const unitPrice = priceMap.get(`${it.product_id}_${it.shade_id || ''}`) || 0;
      const sqftPerBox = parseFloat(it.sqft_per_box) || 0;

      await repo.createItem(trx,{
        tenant_id: tenantId,
        delivery_challan_id: id,
        product_id: it.product_id,
        shade_id: it.shade_id,
        batch_id: it.batch_id,
        dispatched_boxes: it.picked_boxes,
        dispatched_pieces: 0,
        dispatched_sqft: it.picked_boxes * sqftPerBox,
        unit_price: unitPrice
      });

    }

    await trx.commit();

    return getById(id,tenantId);

  } catch(err){
    await trx.rollback();
    throw err;
  } finally{
    trx.release();
  }

};

const dispatch = async (id, tenantId, userId) => {

  const dc = await getById(id,tenantId);

  if (dc.status !== 'draft'){
    throw new AppError('Only draft challans can be dispatched',400,'INVALID_STATUS');
  }

  const warehouseId = dc.warehouse_id;

  if (!warehouseId){
    throw new AppError('Warehouse not found for this challan',400,'MISSING_WAREHOUSE');
  }

  if (!dc.items || dc.items.length === 0){
    throw new AppError('No items found in delivery challan',400,'NO_ITEMS');
  }

  const productIds = dc.items.map(i => i.product_id).filter(Boolean);

  const productRows = await query(`
    SELECT id, sqft_per_box
    FROM products
    WHERE id IN (${productIds.map(()=>'?').join(',')})
  `,productIds);

  const sqftMap = new Map(
    productRows.map(r => [r.id, parseFloat(r.sqft_per_box) || 0])
  );

  const trx = await beginTransaction();

  try{

    for(const item of dc.items){

      const boxesOut = parseFloat(item.dispatched_boxes) || 0;

      if (boxesOut <= 0) continue;

      const sqftPerBox = sqftMap.get(item.product_id) || 0;

      // ── RACK-AWARE STOCK DEDUCTION ────────────────────────────────────────
      // Stock may be stored in specific rack rows (e.g. from GRN with rack allocation).
      // Dispatching with rackId=null would fail if no stock exists at rack_id IS NULL.
      // Fix: find ALL stock_summary rows for this product/warehouse/shade/batch,
      // then drain them proportionally in order (non-null racks first, then null rack).
      const stockRows = await trx.query(
        `SELECT id, rack_id, total_boxes FROM stock_summary
         WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?
           AND (shade_id <=> ?) AND (batch_id <=> ?)
           AND total_boxes > 0
         ORDER BY rack_id IS NULL ASC, total_boxes DESC
         FOR UPDATE`,
        [tenantId, warehouseId, item.product_id, item.shade_id || null, item.batch_id || null]
      );

      // Verify total available
      const totalAvailable = stockRows.reduce((s, r) => s + parseFloat(r.total_boxes || 0), 0);
      if (totalAvailable < boxesOut) {
        throw new Error(
          `Insufficient stock for product ${item.product_id}: need ${boxesOut} boxes, only ${totalAvailable} available`
        );
      }

      // Drain racks in order
      let remaining = boxesOut;
      for (const stockRow of stockRows) {
        if (remaining <= 0) break;
        const deductFromThisRack = Math.min(remaining, parseFloat(stockRow.total_boxes || 0));
        if (deductFromThisRack <= 0) continue;

        await postStockMovement(trx, {
          tenantId,
          warehouseId,
          rackId: stockRow.rack_id || null,
          productId: item.product_id,
          shadeId: item.shade_id || null,
          batchId: item.batch_id || null,
          transactionType: 'sale',
          referenceId: id,
          referenceType: 'delivery_challan',
          boxesIn: 0,
          boxesOut: deductFromThisRack,
          piecesIn: 0,
          piecesOut: 0,
          sqftPerBox,
          unitPrice: null,
          notes: `DC ${dc.dc_number}`,
          createdBy: userId,
        });

        // SYNC RACK OCCUPANCY (FIX #2: Update racks quantity)
        if (stockRow.rack_id) {
          const rackService = require('../racks/rack.service');
          await rackService.syncRackOccupancy(stockRow.rack_id, tenantId);
          
          // Check if rack is now empty for this product and delete from product_racks if so
          // This ensures "racks never become empty" issue is resolved in UI
          await trx.query(
            `DELETE FROM product_racks 
             WHERE tenant_id = ? AND rack_id = ? AND product_id = ? AND boxes_stored <= 0`,
            [tenantId, stockRow.rack_id, item.product_id]
          );
        }

        remaining -= deductFromThisRack;
      }
    }

    await repo.setDispatched(id, tenantId);

    // BUG-3 FIX: Update sales_order status to 'dispatched'
    await trx.query(
      `UPDATE sales_orders SET status = 'dispatched', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [dc.sales_order_id, tenantId]
    );

    await trx.commit();

    const invoiceService = require('../invoices/service');

    try{
      await invoiceService.createFromSalesOrder(
        tenantId,
        userId,
        dc.sales_order_id
      );
    }catch(err){
      console.error('Auto Invoice creation failed:',err.message);
    }

    return getById(id,tenantId);

  }catch(err){

    await trx.rollback();
    throw err;

  }finally{

    trx.release();

  }

};

const update = async (id,tenantId,data) => {

  const dc = await getById(id,tenantId);

  if (dc.status !== 'draft'){
    throw new AppError('Only draft challans can be updated',400,'INVALID_STATUS');
  }

  await repo.updateDraft(id,tenantId,data);

  return getById(id,tenantId);

};

const remove = async (id,tenantId) => {

  const dc = await repo.findById(id,tenantId);

  if (!dc){
    throw new AppError('Delivery challan not found',404,'NOT_FOUND');
  }

  if (dc.status !== 'draft'){
    throw new AppError('Only draft challans can be deleted',400,'INVALID_STATUS');
  }

  await repo.deleteById(id,tenantId);

};

module.exports = {
  getAll,
  getById,
  createFromPickList,
  dispatch,
  update,
  remove
};