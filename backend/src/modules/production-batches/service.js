'use strict';

const repo = require('./repository');
const { beginTransaction } = require('../../config/db');
const { generateDocNumber } = require('../../utils/docNumber');
const { AppError } = require('../../middlewares/error.middleware');

const VALID_TRANSITIONS = {
  pending:     ['in_progress', 'rejected'],
  in_progress: ['completed', 'rejected'],
  completed:   [],
  rejected:    [],
};

const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const getById = async (id, tenantId) => {
  const batch = await repo.findById(id, tenantId);
  if (!batch) throw new AppError('Batch not found', 404, 'NOT_FOUND');
  return batch;
};

const create = async (tenantId, userId, data) => {
  const batchNumber = await generateDocNumber(tenantId, 'BATCH', 'BATCH');
  const trx = await beginTransaction();
  try {
    const id = await repo.create({
      tenant_id:           tenantId,
      batch_number:        batchNumber,
      production_order_id: data.production_order_id || null,
      warehouse_id:        data.warehouse_id,
      product_id:          data.product_id || null,
      quantity_planned:    data.quantity_planned || 0,
      start_date:          data.start_date || null,
      notes:               data.notes || null,
      created_by:          userId,
    }, trx);
    await trx.commit();
    return repo.findById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const update = async (id, tenantId, data) => {
  const batch = await repo.findById(id, tenantId);
  if (!batch) throw new AppError('Batch not found', 404, 'NOT_FOUND');
  if (batch.status === 'completed' || batch.status === 'rejected') {
    throw new AppError('Cannot edit a completed or rejected batch', 400, 'INVALID_STATE');
  }
  const trx = await beginTransaction();
  try {
    const fields = {};
    for (const f of ['production_order_id','warehouse_id','product_id',
                     'quantity_planned','start_date','notes']) {
      if (data[f] !== undefined) fields[f] = data[f];
    }
    await repo.update(id, tenantId, fields, trx);
    await trx.commit();
    return repo.findById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const updateStatus = async (id, tenantId, newStatus, extraFields) => {
  const batch = await repo.findById(id, tenantId);
  if (!batch) throw new AppError('Batch not found', 404, 'NOT_FOUND');

  const allowed = VALID_TRANSITIONS[batch.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot change status from "${batch.status}" to "${newStatus}"`,
      400, 'INVALID_TRANSITION'
    );
  }

  const fields = { status: newStatus };
  if (newStatus === 'in_progress' && !batch.start_date) {
    fields.start_date = new Date().toISOString().slice(0, 10);
  }
  if (newStatus === 'completed' || newStatus === 'rejected') {
    fields.end_date = new Date().toISOString().slice(0, 10);
  }
  if (extraFields?.quantity_produced !== undefined) fields.quantity_produced = extraFields.quantity_produced;
  if (extraFields?.wastage_qty       !== undefined) fields.wastage_qty       = extraFields.wastage_qty;
  if (extraFields?.end_date          !== undefined) fields.end_date          = extraFields.end_date;

  const trx = await beginTransaction();
  try {
    await repo.update(id, tenantId, fields, trx);
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
  const batch = await repo.findById(id, tenantId);
  if (!batch) throw new AppError('Batch not found', 404, 'NOT_FOUND');
  if (batch.status !== 'pending') {
    throw new AppError('Only pending batches can be deleted', 400, 'INVALID_STATE');
  }
  const trx = await beginTransaction();
  try {
    await repo.deleteBatch(id, tenantId, trx);
    await trx.commit();
    return { success: true };
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

module.exports = { getAll, getById, create, update, updateStatus, remove };
