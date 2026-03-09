'use strict';
const repo = require('./repository');
const { beginTransaction } = require('../../config/db');
const { postStockMovement } = require('../../utils/stockHelper');
const { AppError } = require('../../middlewares/error.middleware');
const { query } = require('../../config/db');

const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const getById = async (id, tenantId) => {
  const row = await repo.findById(id, tenantId);
  if (!row) throw new AppError('Stock adjustment not found', 404, 'NOT_FOUND');
  return row;
};

const create = async (tenantId, userId, data) => {
  const boxes = parseFloat(data.boxes) || 0;
  const pieces = parseFloat(data.pieces) || 0;
  if (boxes <= 0 && pieces <= 0) {
    throw new AppError('Boxes or pieces must be greater than zero', 400, 'VALIDATION_ERROR');
  }
  const id = await repo.create({
    tenant_id: tenantId,
    warehouse_id: data.warehouse_id,
    product_id: data.product_id,
    shade_id: data.shade_id || null,
    batch_id: data.batch_id || null,
    rack_id: data.rack_id || null,
    adjustment_type: data.adjustment_type,
    boxes,
    pieces,
    reason: data.reason,
    created_by: userId,
  });
  return repo.findById(id, tenantId);
};

const update = async (id, tenantId, data) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Stock adjustment not found', 404, 'NOT_FOUND');
  if (existing.status !== 'pending') {
    throw new AppError('Only pending adjustments can be updated', 400, 'INVALID_STATUS');
  }
  await repo.update(id, tenantId, data);
  return repo.findById(id, tenantId);
};

const approve = async (id, tenantId, userId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Stock adjustment not found', 404, 'NOT_FOUND');
  if (existing.status !== 'pending') {
    throw new AppError('Only pending adjustments can be approved', 400, 'INVALID_STATUS');
  }

  const boxes = parseFloat(existing.boxes) || 0;
  const pieces = parseFloat(existing.pieces) || 0;
  const boxesIn = existing.adjustment_type === 'add' ? boxes : 0;
  const boxesOut = existing.adjustment_type === 'deduct' ? boxes : 0;
  const piecesIn = existing.adjustment_type === 'add' ? pieces : 0;
  const piecesOut = existing.adjustment_type === 'deduct' ? pieces : 0;

  const trx = await beginTransaction();
  try {
    const productRows = await trx.query('SELECT sqft_per_box FROM products WHERE id = ? AND tenant_id = ?', [existing.product_id, tenantId]);
    const sqftPerBox = productRows[0] ? parseFloat(productRows[0].sqft_per_box) || 0 : 0;

    await postStockMovement(trx, {
      tenantId,
      warehouseId: existing.warehouse_id,
      rackId: existing.rack_id || null,
      productId: existing.product_id,
      shadeId: existing.shade_id || null,
      batchId: existing.batch_id || null,
      transactionType: 'adjustment',
      referenceId: id,
      referenceType: 'stock_adjustment',
      boxesIn,
      boxesOut,
      piecesIn,
      piecesOut,
      sqftPerBox,
      unitPrice: null,
      notes: existing.reason || null,
      createdBy: userId,
    });

    await repo.setApproved(id, tenantId, userId);
    await trx.commit();
    return repo.findById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const remove = async (id, tenantId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Stock adjustment not found', 404, 'NOT_FOUND');
  if (existing.status !== 'pending') {
    throw new AppError('Only pending adjustments can be deleted', 400, 'INVALID_STATUS');
  }
  await repo.remove(id, tenantId);
};

module.exports = { getAll, getById, create, update, approve, remove };
