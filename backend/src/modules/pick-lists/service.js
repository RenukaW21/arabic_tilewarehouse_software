'use strict';
const repo = require('./repository');
const { beginTransaction } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');
const { isWarehouseScopedRole } = require('../../utils/warehouseScope');

const getAll = async (tenantId, queryParams, user) => {
  let params = queryParams;
  if (user && isWarehouseScopedRole(user.role) && user.warehouse_id) {
    params = { ...queryParams, warehouse_id: user.warehouse_id };
  }
  return repo.findAll(tenantId, params);
};

const getById = async (id, tenantId, opts = {}) => {
  const pick = await repo.findById(id, tenantId);
  if (!pick) throw new AppError('Pick list not found', 404, 'NOT_FOUND');
  if (opts.warehouseId && pick.warehouse_id !== opts.warehouseId) {
    throw new AppError('Pick list not found', 404, 'NOT_FOUND');
  }
  const items = await repo.findItemsByPickListId(id, tenantId);
  return { ...pick, items };
};

const assign = async (id, tenantId, assignedTo, opts = {}) => {
  const pick = await getById(id, tenantId, opts);
  if (!['pending', 'in_progress'].includes(pick.status)) {
    throw new AppError('Only pending or in-progress pick lists can be assigned', 400, 'INVALID_STATUS');
  }
  const updates = { assigned_to: assignedTo || null };
  if (pick.status === 'pending' && assignedTo) {
    updates.status = 'in_progress';
    updates.started_at = new Date();
  }
  await repo.update(id, tenantId, updates);
  return getById(id, tenantId, opts);
};

/** Updates pick_list_items only — never posts stock movements (deduction is on challan dispatch). */
const updateItemPicked = async (pickListId, itemId, tenantId, pickedBoxes, opts = {}) => {
  const pick = await getById(pickListId, tenantId, opts);
  if (!['pending', 'in_progress'].includes(pick.status)) {
    throw new AppError('Only pending or in-progress pick lists can be updated', 400, 'INVALID_STATUS');
  }
  const item = pick.items.find((i) => i.id === itemId);
  if (!item) throw new AppError('Pick list item not found', 404, 'NOT_FOUND');

  const requested = parseFloat(item.requested_boxes) || 0;
  const picked = Math.max(0, parseFloat(pickedBoxes) || 0);
  if (picked > requested) {
    throw new AppError(`Picked boxes (${picked}) cannot exceed requested (${requested})`, 400, 'OVER_PICK');
  }

  const trx = await beginTransaction();
  try {
    const available = await repo.getAvailableStock(
      trx,
      tenantId,
      pick.warehouse_id,
      item.product_id,
      item.shade_id,
      item.batch_id
    );
    if (picked > available) {
      throw new AppError(`Insufficient stock: available ${available} boxes`, 400, 'INSUFFICIENT_STOCK');
    }
    await repo.updateItemPicked(itemId, pickListId, tenantId, picked, trx);
    await trx.commit();
    return getById(pickListId, tenantId, opts);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const complete = async (id, tenantId, userId, opts = {}) => {
  const pick = await getById(id, tenantId, opts);
  if (!['pending', 'in_progress'].includes(pick.status)) {
    throw new AppError('Only pending or in-progress pick lists can be completed', 400, 'INVALID_STATUS');
  }
  const hasPickedItems = (pick.items || []).some((item) => (parseFloat(item.picked_boxes) || 0) > 0);
  if (!hasPickedItems) {
    throw new AppError('Pick list has no picked items. Enter picked quantities for at least one item before completing.', 400, 'NO_PICKED_ITEMS');
  }
  
  await repo.update(id, tenantId, { status: 'completed', completed_at: new Date() });

  // AUTOMATIC DELIVERY CHALLAN GENERATION
  const dcService = require('../delivery-challans/service');
  try {
    await dcService.createFromPickList(id, tenantId, userId, {
      dispatch_date: new Date()
    });
  } catch (err) {
    console.error('Auto DC creation failed:', err.message);
    // We don't throw here to avoid blocking the pick list completion if DC fails for some reason
  }

  return getById(id, tenantId, opts);
};

/** Reopen a completed pick list that has no picked items so user can enter quantities and complete again. */
const reopen = async (id, tenantId, opts = {}) => {
  const pick = await getById(id, tenantId, opts);
  if (pick.status !== 'completed') {
    throw new AppError('Only completed pick lists can be reopened', 400, 'INVALID_STATUS');
  }
  const hasPickedItems = (pick.items || []).some((item) => (parseFloat(item.picked_boxes) || 0) > 0);
  if (hasPickedItems) {
    throw new AppError('Cannot reopen a pick list that already has picked items', 400, 'HAS_PICKED_ITEMS');
  }
  const { query } = require('../../config/db');
  const used = await query(
    'SELECT id FROM delivery_challans WHERE pick_list_id = ? AND tenant_id = ? LIMIT 1',
    [id, tenantId]
  );
  if (used.length > 0) {
    throw new AppError('Pick list is already used by a delivery challan', 400, 'IN_USE');
  }
  await repo.update(id, tenantId, { status: 'in_progress', completed_at: null });
  return getById(id, tenantId, opts);
};

const update = async (id, tenantId, data, opts = {}) => {
  const pick = await getById(id, tenantId, opts);
  if (!['pending', 'in_progress'].includes(pick.status)) {
    throw new AppError('Only pending or in-progress pick lists can be updated', 400, 'INVALID_STATUS');
  }
  const updates = {};
  if (data.assigned_to !== undefined) updates.assigned_to = data.assigned_to || null;
  if (Object.keys(updates).length === 0) return getById(id, tenantId, opts);
  if (pick.status === 'pending' && updates.assigned_to) {
    updates.status = 'in_progress';
    updates.started_at = new Date();
  }
  await repo.update(id, tenantId, updates);
  return getById(id, tenantId, opts);
};

const remove = async (id, tenantId, opts = {}) => {
  const pick = await getById(id, tenantId, opts);
  if (pick.status !== 'pending') {
    throw new AppError('Only pending pick lists can be deleted', 400, 'INVALID_STATUS');
  }
  const { query } = require('../../config/db');
  const used = await query(
    'SELECT id FROM delivery_challans WHERE pick_list_id = ? AND tenant_id = ? LIMIT 1',
    [id, tenantId]
  );
  if (used.length > 0) {
    throw new AppError('Pick list is already used by a delivery challan', 400, 'IN_USE');
  }
  await repo.deleteById(id, tenantId);
};

module.exports = { getAll, getById, assign, updateItemPicked, complete, reopen, update, remove };
