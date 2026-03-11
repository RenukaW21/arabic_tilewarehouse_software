'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// FIXED service.js
// Changes:
//   BUG-4: postGRN — guard against damaged_boxes > received_boxes (negative net)
//   BUG-5: updateQuality — auto-verify only when all items are 'pass', not
//          when all items are merely non-pending (e.g. all 'fail'/'rejected')
// ─────────────────────────────────────────────────────────────────────────────
const repo = require('./repository');
const { beginTransaction } = require('../../config/db');
const { generateDocNumber } = require('../../utils/docNumber');
const { postStockMovement } = require('../../utils/stockHelper');
const { AppError } = require('../../middlewares/error.middleware');

const getAll = (tenantId, q) => repo.findAll(tenantId, q);

const getById = async (id, tenantId) => {
  const grn = await repo.findById(id, tenantId);
  if (!grn) throw new AppError('GRN not found', 404, 'NOT_FOUND');
  return grn;
};

const create = async (tenantId, userId, data) => {
  const grnNumber = await generateDocNumber(tenantId, 'GRN', 'GRN');
  const trx = await beginTransaction();
  try {
    const grnId = await repo.createGRN(trx, {
      tenantId,
      grnNumber,
      purchaseOrderId: data.purchaseOrderId,
      vendorId: data.vendorId,
      warehouseId: data.warehouseId,
      receiptDate: data.receiptDate,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      vehicleNumber: data.vehicleNumber,
      notes: data.notes,
      createdBy: userId,
    });

    for (const item of data.items || []) {
      await repo.createGRNItem(trx, {
        tenantId,
        grnId,
        product_id: item.product_id,
        shade_id: item.shade_id || null,
        batch_id: item.batch_id || null,
        rack_id: item.rack_id || null,
        received_boxes: item.received_boxes ?? 0,
        received_pieces: item.received_pieces ?? 0,
        damaged_boxes: item.damaged_boxes ?? 0,
        unit_price: item.unit_price ?? 0,
        quality_status: item.quality_status || 'pending',
        quality_notes: item.quality_notes || null,
      });
    }

    await repo.recalcGrandTotal(grnId, tenantId, trx);
    await trx.commit();
    return repo.findById(grnId, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const postGRN = async (id, tenantId, userId) => {
  const grn = await getById(id, tenantId);
  if (grn.status !== 'draft' && grn.status !== 'verified') {
    throw new AppError(`GRN cannot be posted in status: ${grn.status}`, 400, 'INVALID_STATUS');
  }

  const trx = await beginTransaction();
  try {
    for (const item of grn.items) {
      const received = parseFloat(item.received_boxes) || 0;
      const damaged = parseFloat(item.damaged_boxes) || 0;

      // FIX BUG-4: clamp to 0 — damaged_boxes should never exceed received_boxes,
      // but if bad data exists we must not post negative stock.
      const netBoxes = Math.max(0, received - damaged);

      if (netBoxes > 0 && item.quality_status === 'pass') {
        const productRows = await trx.query(
          'SELECT sqft_per_box FROM products WHERE id = ? AND tenant_id = ?',
          [item.product_id, tenantId]
        );
        const sqftPerBox = productRows[0]
          ? parseFloat(productRows[0].sqft_per_box) || 0
          : parseFloat(item.sqft_per_box || 0);

        await postStockMovement(trx, {
          tenantId,
          warehouseId: grn.warehouse_id,
          rackId: item.rack_id,
          productId: item.product_id,
          shadeId: item.shade_id,
          batchId: item.batch_id,
          transactionType: 'grn',
          referenceId: id,
          referenceType: 'grn',
          boxesIn: netBoxes,
          piecesIn: parseFloat(item.received_pieces || 0),
          sqftPerBox,
          notes: `GRN Posted: ${grn.grn_number}`,
          createdBy: userId,
        });
      }
    }

    await repo.updateStatus(trx, id, tenantId, 'posted');
    await repo.recalcGrandTotal(id, tenantId, trx);
    await repo.updatePOReceivedBoxes(trx, grn.purchase_order_id, tenantId);

    await trx.commit();
    return getById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const updateQuality = async (id, tenantId, itemId, qualityData) => {
  const { query } = require('../../config/db');

  await query(
    `UPDATE grn_items SET quality_status = ?, quality_notes = ?
     WHERE id = ? AND grn_id = ? AND tenant_id = ?`,
    [qualityData.qualityStatus, qualityData.qualityNotes || null, itemId, id, tenantId]
  );

  const items = await query(
    `SELECT quality_status FROM grn_items WHERE grn_id = ? AND tenant_id = ?`,
    [id, tenantId]
  );

  // FIX BUG-5: auto-verify only when ALL items are 'pass'.
  // Old code: items.every(i => i.quality_status !== 'pending')
  //   → incorrectly set status='verified' even when all items were 'fail'
  // New code: every item must be explicitly 'pass'
  const allPassed = items.length > 0 && items.every((i) => i.quality_status === 'pass');
  if (allPassed) {
    await query(
      `UPDATE grn SET status = 'verified' WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
  }
};

const update = async (id, tenantId, data) => {
  const grn = await getById(id, tenantId);
  if (grn.status !== 'draft' && grn.status !== 'verified') {
    throw new AppError(`GRN cannot be updated in status: ${grn.status}`, 400, 'INVALID_STATUS');
  }
  const payload = {};
  const map = {
    receipt_date: data.receipt_date ?? data.receiptDate,
    invoice_number: data.invoice_number ?? data.invoiceNumber,
    invoice_date: data.invoice_date ?? data.invoiceDate,
    vehicle_number: data.vehicle_number ?? data.vehicleNumber,
    notes: data.notes,
    vendor_id: data.vendor_id ?? data.vendorId,
    warehouse_id: data.warehouse_id ?? data.warehouseId,
  };
  for (const [k, v] of Object.entries(map)) {
    if (v !== undefined) payload[k] = v;
  }
  if (Object.keys(payload).length > 0) await repo.updateGRN(id, tenantId, payload);
  return getById(id, tenantId);
};

const addItem = async (id, tenantId, data) => {
  const grn = await getById(id, tenantId);
  if (grn.status !== 'draft' && grn.status !== 'verified') {
    throw new AppError(`Cannot add items to GRN in status: ${grn.status}`, 400, 'INVALID_STATUS');
  }
  await repo.addGRNItem(tenantId, id, {
    product_id: data.product_id,
    shade_id: data.shade_id ?? null,
    batch_id: data.batch_id ?? null,
    rack_id: data.rack_id ?? null,
    received_boxes: data.received_boxes ?? 0,
    received_pieces: data.received_pieces ?? 0,
    damaged_boxes: data.damaged_boxes ?? 0,
    unit_price: data.unit_price ?? 0,
    quality_status: data.quality_status ?? 'pending',
    quality_notes: data.quality_notes ?? null,
  });
  return getById(id, tenantId);
};

const updateItem = async (id, tenantId, itemId, data) => {
  const grn = await getById(id, tenantId);
  if (grn.status !== 'draft' && grn.status !== 'verified') {
    throw new AppError(`Cannot update items of GRN in status: ${grn.status}`, 400, 'INVALID_STATUS');
  }
  const payload = {};
  const map = {
    product_id: data.product_id,
    shade_id: data.shade_id,
    batch_id: data.batch_id,
    batch_number: data.batch_number,
    rack_id: data.rack_id,
    received_boxes: data.received_boxes,
    received_pieces: data.received_pieces,
    damaged_boxes: data.damaged_boxes,
    unit_price: data.unit_price,
    quality_status: data.quality_status,
    quality_notes: data.quality_notes,
  };

  for (const [k, v] of Object.entries(map)) {
    if (v !== undefined) payload[k] = v;
  }

  if (Object.keys(payload).length > 0) {
    await repo.updateGRNItem(tenantId, id, itemId, payload);
  }
  return getById(id, tenantId);
};

const deleteItem = async (id, tenantId, itemId) => {
  const grn = await getById(id, tenantId);
  if (grn.status !== 'draft') {
    throw new AppError('Only draft GRNs can have items deleted', 400, 'INVALID_STATUS');
  }
  await repo.removeGRNItem(tenantId, id, itemId);
  return getById(id, tenantId);
};

const generateLabels = async (id, tenantId, itemId) => {
  const grn = await getById(id, tenantId);
  const item = grn.items.find((i) => i.id === itemId);
  if (!item) throw new AppError('GRN item not found', 404, 'NOT_FOUND');
  await repo.markBarcodePrinted(tenantId, id, itemId);
  return { success: true, item };
};

const remove = async (id, tenantId) => {
  const grn = await getById(id, tenantId);
  if (grn.status !== 'draft') {
    throw new AppError('Only draft GRNs can be deleted', 400, 'INVALID_STATUS');
  }
  const deleted = await repo.deleteGRN(id, tenantId);
  if (!deleted) throw new AppError('GRN not found or not draft', 404, 'NOT_FOUND');
  return { id, deleted: true };
};

module.exports = { getAll, getById, create, update, addItem, updateItem, deleteItem, generateLabels, remove, postGRN, updateQuality };