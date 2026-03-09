'use strict';
const repo = require('./repository');
const { query, beginTransaction } = require('../../config/db');
const { postStockMovement } = require('../../utils/stockHelper');
const { AppError } = require('../../middlewares/error.middleware');

const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const getById = async (id, tenantId) => {
  const row = await repo.findById(id, tenantId);
  if (!row) throw new AppError('Damage entry not found', 404, 'NOT_FOUND');
  return row;
};

/** Returns true if this damage entry has been posted to stock_ledger (no edit/delete allowed). */
const isPostedToLedger = async (id, tenantId) => {
  const rows = await query(
    'SELECT 1 FROM stock_ledger WHERE reference_type = ? AND reference_id = ? AND tenant_id = ? LIMIT 1',
    ['damage_entry', id, tenantId]
  );
  return rows.length > 0;
};

const create = async (tenantId, userId, data) => {
  const boxesOut = parseFloat(data.damaged_boxes) || 0;
  const piecesOut = parseFloat(data.damaged_pieces) || 0;
  if (boxesOut <= 0 && piecesOut <= 0) {
    throw new AppError('Damaged boxes or pieces must be greater than zero', 400, 'VALIDATION_ERROR');
  }

  const trx = await beginTransaction();
  try {
    const id = await repo.create(trx, {
      tenant_id: tenantId,
      warehouse_id: data.warehouse_id,
      product_id: data.product_id,
      shade_id: data.shade_id || null,
      batch_id: data.batch_id || null,
      rack_id: data.rack_id || null,
      damage_date: data.damage_date || new Date(),
      damaged_boxes: boxesOut,
      damaged_pieces: piecesOut,
      damage_reason: data.damage_reason || null,
      estimated_loss: data.estimated_loss ?? null,
      created_by: userId,
      notes: data.notes || null,
    });

    const productRows = await trx.query('SELECT sqft_per_box FROM products WHERE id = ? AND tenant_id = ?', [data.product_id, tenantId]);
    const sqftPerBox = productRows[0] ? parseFloat(productRows[0].sqft_per_box) || 0 : 0;

    await postStockMovement(trx, {
      tenantId,
      warehouseId: data.warehouse_id,
      rackId: data.rack_id || null,
      productId: data.product_id,
      shadeId: data.shade_id || null,
      batchId: data.batch_id || null,
      transactionType: 'damage',
      referenceId: id,
      referenceType: 'damage_entry',
      boxesIn: 0,
      boxesOut,
      piecesIn: 0,
      piecesOut,
      sqftPerBox,
      unitPrice: null,
      notes: data.damage_reason || null,
      createdBy: userId,
    });

    await trx.commit();
    return repo.findById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    if (err.message && (err.message.includes('Insufficient stock') || err.message.includes('cannot post'))) {
      throw new AppError(err.message || 'Insufficient stock for this damage entry.', 400, 'INSUFFICIENT_STOCK');
    }
    throw err;
  } finally {
    trx.release();
  }
};

const updateRecord = async (id, tenantId, data) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Damage entry not found', 404, 'NOT_FOUND');
  if (await isPostedToLedger(id, tenantId)) {
    throw new AppError('Cannot edit a damage entry that has been posted to stock. It would corrupt the ledger.', 400, 'POSTED_NO_EDIT');
  }
  await repo.update(id, tenantId, data);
  return repo.findById(id, tenantId);
};

const remove = async (id, tenantId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Damage entry not found', 404, 'NOT_FOUND');
  if (await isPostedToLedger(id, tenantId)) {
    throw new AppError('Cannot delete a damage entry that has been posted to stock. It would corrupt the ledger.', 400, 'POSTED_NO_DELETE');
  }
  await repo.remove(id, tenantId);
};

module.exports = { getAll, getById, create, update: updateRecord, remove };
