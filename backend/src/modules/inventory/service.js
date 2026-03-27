'use strict';
const repo = require('./repository');
const { beginTransaction } = require('../../config/db');
const { postStockMovement } = require('../../utils/stockHelper');
const { AppError } = require('../../middlewares/error.middleware');

const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const getById = async (id, tenantId) => {
  const row = await repo.findById(id, tenantId);
  if (!row) throw new AppError('Stock record not found', 404, 'NOT_FOUND');
  return row;
};

/**
 * Create opening stock: insert ledger entry (transaction_type = 'opening') and update stock_summary.
 * Uses postStockMovement in a transaction.
 */
const createOpeningStock = async (tenantId, userId, data) => {
  const { query } = require('../../config/db');
  const trx = await beginTransaction();
  try {
    const boxesIn = parseFloat(data.boxes) || 0;
    const piecesIn = parseFloat(data.pieces) || 0;
    if (boxesIn <= 0 && piecesIn <= 0) {
      throw new AppError('Opening stock must have boxes or pieces greater than zero', 400, 'VALIDATION_ERROR');
    }

    let sqftPerBox = data.sqft_per_box != null ? parseFloat(data.sqft_per_box) : null;
    if (sqftPerBox == null || isNaN(sqftPerBox)) {
      const productRows = await query('SELECT sqft_per_box FROM products WHERE id = ? AND tenant_id = ?', [data.product_id, tenantId]);
      if (!productRows.length) throw new AppError('Product not found', 404, 'NOT_FOUND');
      sqftPerBox = parseFloat(productRows[0].sqft_per_box) || 0;
    }
    await postStockMovement(trx, {
      tenantId,
      warehouseId: data.warehouse_id,
      rackId: data.rack_id || null,
      productId: data.product_id,
      shadeId: data.shade_id || null,
      batchId: data.batch_id || null,
      transactionType: 'opening',
      referenceId: null,
      referenceType: null,
      boxesIn,
      boxesOut: 0,
      piecesIn,
      piecesOut: 0,
      sqftPerBox: Number(sqftPerBox) || 0,
      unitPrice: data.unit_price != null ? parseFloat(data.unit_price) : null,
      notes: data.notes || null,
      createdBy: userId,
    });

    await trx.commit();
    const summary = await repo.findAll(tenantId, {
      limit: 1,
      page: 1,
      search: '',
      sortBy: 'updated_at',
      sortOrder: 'DESC',
    });
    return summary.rows[0] || null;
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

/**
 * Manual stock adjustment: insert ledger entry (transaction_type = 'adjustment') and update stock_summary.
 * Uses postStockMovement. Prevents negative balance.
 */
const adjustStock = async (id, tenantId, userId, data) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Stock record not found', 404, 'NOT_FOUND');

  const boxesIn = Math.max(0, parseFloat(data.boxes_in) || 0);
  const boxesOut = Math.max(0, parseFloat(data.boxes_out) || 0);
  const piecesIn = Math.max(0, parseFloat(data.pieces_in) || 0);
  const piecesOut = Math.max(0, parseFloat(data.pieces_out) || 0);

  if (boxesIn === 0 && boxesOut === 0 && piecesIn === 0 && piecesOut === 0) {
    throw new AppError('At least one of boxes_in, boxes_out, pieces_in, pieces_out must be non-zero', 400, 'VALIDATION_ERROR');
  }

  const trx = await beginTransaction();
  try {
    const sqftPerBox = parseFloat(existing.sqft_per_box) || 0;
    await postStockMovement(trx, {
      tenantId,
      warehouseId: existing.warehouse_id,
      rackId: existing.rack_id || null,
      productId: existing.product_id,
      shadeId: existing.shade_id || null,
      batchId: existing.batch_id || null,
      transactionType: 'adjustment',
      referenceId: id,
      referenceType: 'stock_summary',
      boxesIn,
      boxesOut,
      piecesIn,
      piecesOut,
      sqftPerBox,
      unitPrice: null,
      notes: data.notes || null,
      createdBy: userId,
    });

    await trx.commit();
    return repo.findById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

/**
 * Rack assignment: move qty boxes from an unassigned (or source) stock_summary bin into a rack.
 * Total stock does NOT change — this is purely a location transfer within the same warehouse.
 *
 * Body: { stock_summary_id, rack_id, boxes, notes }
 *   stock_summary_id — the source stock_summary row (usually rack_id = null, i.e. unassigned)
 *   rack_id          — the target rack to move stock into
 *   boxes            — qty to move
 */
const assignToRack = async (tenantId, userId, data) => {
  const { query } = require('../../config/db');
  const source = await repo.findById(data.stock_summary_id, tenantId);
  if (!source) throw new AppError('Stock record not found', 404, 'NOT_FOUND');

  const boxes = parseFloat(data.boxes) || 0;
  if (boxes <= 0) throw new AppError('boxes must be greater than zero', 400, 'VALIDATION_ERROR');
  if (parseFloat(source.total_boxes) < boxes) {
    throw new AppError(
      `Insufficient stock: ${source.total_boxes} boxes available, ${boxes} requested`,
      400,
      'INSUFFICIENT_STOCK'
    );
  }

  const targetRackId = data.rack_id;
  if (!targetRackId) throw new AppError('rack_id is required', 400, 'VALIDATION_ERROR');

  // Prevent assigning to the same rack (no-op)
  if (source.rack_id === targetRackId) {
    throw new AppError('Source and target rack are the same', 400, 'VALIDATION_ERROR');
  }

  const rackRows = await query(
    `SELECT id, capacity_boxes, occupied_boxes, available_boxes, rack_status
     FROM racks WHERE id = ? AND tenant_id = ?`,
    [targetRackId, tenantId]
  );
  if (!rackRows.length) throw new AppError('Target rack not found', 404, 'NOT_FOUND');
  const rack = rackRows[0];
  if (rack.rack_status === 'BLOCKED' || rack.rack_status === 'MAINTENANCE') {
    throw new AppError(`Rack is not available (status: ${rack.rack_status})`, 400, 'RACK_UNAVAILABLE');
  }
  if (rack.capacity_boxes !== null && rack.available_boxes !== null && parseFloat(rack.available_boxes) < boxes) {
    throw new AppError(
      `Rack capacity exceeded: ${rack.available_boxes} boxes available, ${boxes} requested`,
      400,
      'RACK_FULL'
    );
  }

  const sqftPerBox = parseFloat(source.sqft_per_box) || 0;
  const trx = await beginTransaction();
  try {
    // 1 — Deduct from source bin
    await postStockMovement(trx, {
      tenantId,
      warehouseId: source.warehouse_id,
      rackId: source.rack_id || null,
      productId: source.product_id,
      shadeId: source.shade_id || null,
      batchId: source.batch_id || null,
      transactionType: 'rack_assignment',
      referenceId: targetRackId,
      referenceType: 'rack',
      boxesIn: 0,
      boxesOut: boxes,
      piecesIn: 0,
      piecesOut: 0,
      sqftPerBox,
      notes: data.notes || `Rack assignment to ${targetRackId}`,
      createdBy: userId,
    });

    // 2 — Add to target rack bin
    await postStockMovement(trx, {
      tenantId,
      warehouseId: source.warehouse_id,
      rackId: targetRackId,
      productId: source.product_id,
      shadeId: source.shade_id || null,
      batchId: source.batch_id || null,
      transactionType: 'rack_assignment',
      referenceId: source.id,
      referenceType: 'stock_summary',
      boxesIn: boxes,
      boxesOut: 0,
      piecesIn: 0,
      piecesOut: 0,
      sqftPerBox,
      notes: data.notes || `Rack assignment from ${source.rack_id || 'unassigned'}`,
      createdBy: userId,
    });

    await trx.commit();
    return repo.findById(data.stock_summary_id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

/**
 * Stock summary rows cannot be deleted (no status flag; ledger history must be preserved).
 * Return 400 with clear message.
 */
const remove = async (id, tenantId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Stock record not found', 404, 'NOT_FOUND');
  throw new AppError(
    'Stock summary records cannot be deleted to preserve ledger and audit history. Use stock adjustment to zero out if needed.',
    400,
    'DELETE_NOT_ALLOWED'
  );
};

module.exports = {
  getAll,
  getById,
  createOpeningStock,
  adjustStock,
  assignToRack,
  remove,
};
