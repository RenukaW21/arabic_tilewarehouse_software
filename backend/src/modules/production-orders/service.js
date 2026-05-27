'use strict';

const repo = require('./repository');
const { beginTransaction } = require('../../config/db');
const { generateDocNumber } = require('../../utils/docNumber');
const { postStockMovement } = require('../../utils/stockHelper');
const { AppError } = require('../../middlewares/error.middleware');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const getFullOrder = async (id, tenantId) => {
  const order = await repo.findById(id, tenantId);
  if (!order) throw new AppError('Production order not found', 404, 'NOT_FOUND');
  const [materials, outputs] = await Promise.all([
    repo.findMaterials(id, tenantId),
    repo.findOutputs(id, tenantId),
  ]);
  return { ...order, materials, outputs };
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────

const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

// ─── GET BY ID ────────────────────────────────────────────────────────────────

const getById = async (id, tenantId) => getFullOrder(id, tenantId);

// ─── CREATE ───────────────────────────────────────────────────────────────────

const create = async (tenantId, userId, data) => {
  const orderNumber = await generateDocNumber(tenantId, 'PROD', 'PROD');
  const trx = await beginTransaction();
  try {
    const id = await repo.createOrder({
      tenant_id:    tenantId,
      order_number: orderNumber,
      warehouse_id: data.warehouse_id,
      planned_date: data.planned_date,
      labor_cost:   data.labor_cost   || 0,
      machine_cost: data.machine_cost || 0,
      wastage_cost: data.wastage_cost || 0,
      notes:        data.notes        || null,
      created_by:   userId,
    }, trx);

    if (data.materials?.length) {
      await repo.replaceMaterials(id, tenantId, data.materials, trx);
    }
    if (data.outputs?.length) {
      await repo.replaceOutputs(id, tenantId, data.outputs, trx);
    }

    await repo.recalcTotals(id, tenantId, trx);
    await trx.commit();
    return getFullOrder(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────

const update = async (id, tenantId, data) => {
  const order = await repo.findById(id, tenantId);
  if (!order) throw new AppError('Production order not found', 404, 'NOT_FOUND');
  if (order.status === 'completed' || order.status === 'cancelled') {
    throw new AppError('Cannot edit a completed or cancelled production order', 400, 'INVALID_STATE');
  }

  const trx = await beginTransaction();
  try {
    const headerFields = {};
    for (const f of ['warehouse_id','planned_date','labor_cost','machine_cost','wastage_cost','notes']) {
      if (data[f] !== undefined) headerFields[f] = data[f];
    }
    if (Object.keys(headerFields).length) {
      await repo.updateOrder(id, tenantId, headerFields, trx);
    }

    if (Array.isArray(data.materials)) {
      await repo.replaceMaterials(id, tenantId, data.materials, trx);
    }
    if (Array.isArray(data.outputs)) {
      await repo.replaceOutputs(id, tenantId, data.outputs, trx);
    }

    await repo.recalcTotals(id, tenantId, trx);
    await trx.commit();
    return getFullOrder(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

// ─── STATUS TRANSITION ────────────────────────────────────────────────────────

const VALID_TRANSITIONS = {
  draft:       ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed:   [],
  cancelled:   [],
};

const updateStatus = async (id, tenantId, newStatus, userId) => {
  const order = await repo.findById(id, tenantId);
  if (!order) throw new AppError('Production order not found', 404, 'NOT_FOUND');

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot change status from "${order.status}" to "${newStatus}"`,
      400, 'INVALID_TRANSITION'
    );
  }

  const trx = await beginTransaction();
  try {
    const fields = { status: newStatus };
    if (newStatus === 'completed') fields.completion_date = new Date().toISOString().slice(0, 10);

    await repo.updateOrder(id, tenantId, fields, trx);

    // When completing: deduct raw materials from stock, add finished goods to stock
    if (newStatus === 'completed') {
      const [materials, outputs] = await Promise.all([
        repo.findMaterials(id, tenantId, trx),
        repo.findOutputs(id, tenantId, trx),
      ]);

      for (const mat of materials) {
        const qty = parseFloat(mat.actual_qty) || parseFloat(mat.planned_qty) || 0;
        if (qty > 0) {
          await postStockMovement(trx, {
            tenantId,
            warehouseId:     order.warehouse_id,
            productId:       mat.product_id,
            transactionType: 'production_material',
            referenceId:     id,
            referenceType:   'production_order',
            boxesOut:        qty,
            notes:           `Production Order ${order.order_number} — material consumed`,
            createdBy:       userId,
          });
        }
      }

      for (const out of outputs) {
        const qty = parseFloat(out.actual_qty) || parseFloat(out.planned_qty) || 0;
        if (qty > 0) {
          await postStockMovement(trx, {
            tenantId,
            warehouseId:     order.warehouse_id,
            productId:       out.product_id,
            transactionType: 'production_output',
            referenceId:     id,
            referenceType:   'production_order',
            boxesIn:         qty,
            unitPrice:       parseFloat(out.unit_cost) || 0,
            notes:           `Production Order ${order.order_number} — finished goods`,
            createdBy:       userId,
          });
        }
      }
    }

    await trx.commit();
    return getFullOrder(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────

const remove = async (id, tenantId) => {
  const order = await repo.findById(id, tenantId);
  if (!order) throw new AppError('Production order not found', 404, 'NOT_FOUND');
  if (order.status !== 'draft') {
    throw new AppError('Only draft production orders can be deleted', 400, 'INVALID_STATE');
  }
  const trx = await beginTransaction();
  try {
    await repo.deleteOrder(id, tenantId, trx);
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
