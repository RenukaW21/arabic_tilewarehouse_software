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

/**
 * Create delivery challan from a completed pick list.
 * Copies pick list items (picked_boxes) to delivery_challan_items.
 */
const createFromPickList = async (pickListId, tenantId, userId, body = {}) => {
  const pickRows = await query(
    `SELECT pl.*, so.so_number, so.customer_id, so.warehouse_id
     FROM pick_lists pl
     JOIN sales_orders so ON pl.sales_order_id = so.id AND so.tenant_id = pl.tenant_id
     WHERE pl.id = ? AND pl.tenant_id = ?`,
    [pickListId, tenantId]
  );
  if (!pickRows || pickRows.length === 0) throw new AppError('Pick list not found', 404, 'NOT_FOUND');
  const pick = pickRows[0];
  if (pick.status !== 'completed') {
    throw new AppError('Only completed pick lists can be used to create delivery challan', 400, 'INVALID_STATUS');
  }

  const items = await query(
    `SELECT pli.*, p.sqft_per_box
     FROM pick_list_items pli
     JOIN products p ON pli.product_id = p.id
     WHERE pli.pick_list_id = ? AND pli.tenant_id = ? AND pli.picked_boxes > 0`,
    [pickListId, tenantId]
  );
  if (items.length === 0) throw new AppError('Pick list has no picked items', 400, 'NO_ITEMS');

  const soItemPrices = await query(
    `SELECT product_id, shade_id, unit_price FROM sales_order_items WHERE sales_order_id = ? AND tenant_id = ?`,
    [pick.sales_order_id, tenantId]
  );
  const priceMap = new Map();
  soItemPrices.forEach((r) => priceMap.set(`${r.product_id}_${r.shade_id || ''}`, r.unit_price));

  const dcNumber = await generateDocNumber(tenantId, 'DC', 'DC');
  const id = uuidv4();
  const trx = await beginTransaction();
  try {
    await repo.create(trx, {
      id,
      tenant_id: tenantId,
      dc_number: dcNumber,
      sales_order_id: pick.sales_order_id,
      pick_list_id: pickListId,
      customer_id: pick.customer_id,
      dispatch_date: body.dispatch_date || new Date(),
      vehicle_number: body.vehicle_number || null,
      transporter_name: body.transporter_name || null,
      lr_number: body.lr_number || null,
      created_by: userId,
    });

    for (const it of items) {
      const unitPrice = priceMap.get(`${it.product_id}_${it.shade_id || ''}`) || 0;
      const sqftPerBox = parseFloat(it.sqft_per_box) || 0;
      await repo.createItem(trx, {
        tenant_id: tenantId,
        delivery_challan_id: id,
        product_id: it.product_id,
        shade_id: it.shade_id,
        batch_id: it.batch_id,
        dispatched_boxes: it.picked_boxes,
        dispatched_pieces: 0,
        dispatched_sqft: it.picked_boxes * sqftPerBox,
        unit_price: unitPrice,
      });
    }
    await trx.commit();
    return getById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

/**
 * Dispatch: post stock_ledger (sale), update stock_summary, set status = dispatched.
 * Uses postStockMovement (which uses SELECT FOR UPDATE on stock_summary).
 */
const dispatch = async (id, tenantId, userId) => {
  const dc = await getById(id, tenantId);
  if (dc.status !== 'draft') throw new AppError('Only draft challans can be dispatched', 400, 'INVALID_STATUS');
  const warehouseId = dc.warehouse_id;
  if (!warehouseId) throw new AppError('Warehouse not found for this challan', 400, 'MISSING_WAREHOUSE');

  const productRows = await query(
    `SELECT id, sqft_per_box FROM products WHERE id IN (${dc.items.map((i) => '?').join(',')})`,
    dc.items.map((i) => i.product_id)
  );
  const sqftMap = new Map(productRows.map((r) => [r.id, parseFloat(r.sqft_per_box) || 0]));

  const trx = await beginTransaction();
  try {
    for (const item of dc.items) {
      const boxesOut = parseFloat(item.dispatched_boxes) || 0;
      if (boxesOut <= 0) continue;
      const sqftPerBox = sqftMap.get(item.product_id) || 0;
      await postStockMovement(trx, {
        tenantId,
        warehouseId,
        rackId: null,
        productId: item.product_id,
        shadeId: item.shade_id || null,
        batchId: item.batch_id || null,
        transactionType: 'sale',
        referenceId: id,
        referenceType: 'delivery_challan',
        boxesIn: 0,
        boxesOut,
        piecesIn: 0,
        piecesOut: 0,
        sqftPerBox,
        unitPrice: null,
        notes: `DC ${dc.dc_number}`,
        createdBy: userId,
      });
    }
    await repo.setDispatched(id, tenantId);
    await trx.commit();
    return getById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const update = async (id, tenantId, data) => {
  const dc = await getById(id, tenantId);
  if (dc.status !== 'draft') throw new AppError('Only draft challans can be updated', 400, 'INVALID_STATUS');
  await repo.updateDraft(id, tenantId, data);
  return getById(id, tenantId);
};

const remove = async (id, tenantId) => {
  const dc = await repo.findById(id, tenantId);
  if (!dc) throw new AppError('Delivery challan not found', 404, 'NOT_FOUND');
  if (dc.status !== 'draft') throw new AppError('Only draft challans can be deleted', 400, 'INVALID_STATUS');
  await repo.deleteById(id, tenantId);
};

module.exports = { getAll, getById, createFromPickList, dispatch, update, remove };
