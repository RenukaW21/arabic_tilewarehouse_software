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

const fetchDamageSourceRows = async (trx, { tenantId, warehouseId, productId, shadeId, batchId, rackId, boxesNeeded }) => {
  const conditions = ['tenant_id = ?', 'warehouse_id = ?', 'product_id = ?', 'total_boxes > 0'];
  const params = [tenantId, warehouseId, productId];

  if (rackId) {
    conditions.push('rack_id = ?');
    params.push(rackId);
  }

  if (shadeId !== undefined && shadeId !== null) {
    conditions.push('(shade_id <=> ?)');
    params.push(shadeId);
  }

  if (batchId !== undefined && batchId !== null) {
    conditions.push('(batch_id <=> ?)');
    params.push(batchId);
  }

  const rows = await trx.query(
    `SELECT id, rack_id, shade_id, batch_id, total_boxes
     FROM stock_summary
     WHERE ${conditions.join(' AND ')}
     ORDER BY (rack_id IS NOT NULL), total_boxes DESC
     FOR UPDATE`,
    params
  );

  const totalAvailable = rows.reduce((sum, row) => sum + (parseFloat(row.total_boxes) || 0), 0);
  if (totalAvailable + 1e-9 < boxesNeeded) {
    throw new AppError(
      `Insufficient stock in warehouse: need ${boxesNeeded} boxes, have ${totalAvailable} ` +
      `(product:${productId} warehouse:${warehouseId} type:damage).`,
      400,
      'INSUFFICIENT_STOCK'
    );
  }

  return rows;
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

    const sourceRows = await fetchDamageSourceRows(trx, {
      tenantId,
      warehouseId: data.warehouse_id,
      productId: data.product_id,
      shadeId: data.shade_id || null,
      batchId: data.batch_id || null,
      rackId: data.rack_id || null,
      boxesNeeded: boxesOut,
    });

    let remainingBoxes = boxesOut;
    let remainingPieces = piecesOut;
    for (const sourceRow of sourceRows) {
      if (remainingBoxes <= 0 && remainingPieces <= 0) break;

      const availableBoxes = parseFloat(sourceRow.total_boxes) || 0;
      const boxesBefore = remainingBoxes;
      const boxesToDeduct = boxesBefore > 0 ? Math.min(boxesBefore, availableBoxes) : 0;
      if (boxesBefore > 0 && boxesToDeduct <= 0) continue;

      const piecesToDeduct = remainingPieces > 0
        ? (boxesBefore > 0 && boxesBefore - boxesToDeduct > 0
          ? Math.floor(remainingPieces * boxesToDeduct / boxesBefore)
          : remainingPieces)
        : 0;
      if (boxesToDeduct <= 0 && piecesToDeduct <= 0) continue;

      await postStockMovement(trx, {
        tenantId,
        warehouseId: data.warehouse_id,
        rackId: sourceRow.rack_id || null,
        productId: data.product_id,
        shadeId: sourceRow.shade_id != null ? sourceRow.shade_id : null,
        batchId: sourceRow.batch_id != null ? sourceRow.batch_id : null,
        transactionType: 'damage',
        referenceId: id,
        referenceType: 'damage_entry',
        boxesIn: 0,
        boxesOut: boxesToDeduct,
        piecesIn: 0,
        piecesOut: piecesToDeduct,
        sqftPerBox,
        unitPrice: null,
        notes: data.damage_reason || null,
        createdBy: userId,
      });

      remainingBoxes -= boxesToDeduct;
      remainingPieces -= piecesToDeduct;
    }

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
