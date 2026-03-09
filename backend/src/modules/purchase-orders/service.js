'use strict';
const repo = require('./repository');
const { generateDocNumber } = require('../../utils/docNumber');
const { beginTransaction } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const getById = async (id, tenantId) => {
  const po = await repo.findById(id, tenantId);
  if (!po) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');
  const items = await repo.findItemsByPOId(id, tenantId);
  return { ...po, items };
};

const create = async (tenantId, userId, data) => {
  const poNumber = await generateDocNumber(tenantId, 'PO', 'PO');
  const trx = await beginTransaction();
  try {
    let totalAmount = 0;
    (data.items || []).forEach((it) => {
      totalAmount +=
        (parseFloat(it.ordered_boxes) || 0) * (parseFloat(it.unit_price) || 0) *
        (1 - (parseFloat(it.discount_pct) || 0) / 100) *
        (1 + (parseFloat(it.tax_pct) || 0) / 100);
    });
    const poId = await repo.createPO({
      tenant_id: tenantId,
      po_number: poNumber,
      vendor_id: data.vendor_id,
      warehouse_id: data.warehouse_id,
      order_date: data.order_date,
      expected_date: data.expected_date || null,
      notes: data.notes || null,
      total_amount: totalAmount,
      discount_amount: 0,
      tax_amount: 0,
      grand_total: totalAmount,
      created_by: userId,
    }, trx);
    for (const it of data.items || []) {
      const duplicate = await repo.findProductInPO(poId, it.product_id, it.shade_id || null, null, tenantId);
      if (duplicate) throw new AppError(`Duplicate product in PO`, 400, 'DUPLICATE_PRODUCT');
      await repo.createPOItem({
        tenant_id: tenantId,
        purchase_order_id: poId,
        product_id: it.product_id,
        shade_id: it.shade_id || null,
        ordered_boxes: it.ordered_boxes,
        ordered_pieces: it.ordered_pieces ?? 0,
        unit_price: it.unit_price,
        discount_pct: it.discount_pct ?? 0,
        tax_pct: it.tax_pct ?? 0,
      }, trx);
    }
    await trx.commit();
    return getById(poId, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const update = async (id, tenantId, data) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');
  if (existing.status !== 'draft') {
    throw new AppError('Only draft purchase orders can be updated', 400, 'INVALID_STATUS');
  }
  const trx = await beginTransaction();
  try {
    const payload = {
      vendor_id: data.vendor_id,
      warehouse_id: data.warehouse_id,
      order_date: data.order_date,
      expected_date: data.expected_date ?? null,
      notes: data.notes ?? null,
    };
    if (Object.keys(payload).some((k) => data[k] !== undefined)) {
      await repo.updatePO(id, tenantId, payload, trx);
    }
    if (Array.isArray(data.items)) {
      await repo.deleteAllPOItems(id, tenantId, trx);
      let totalAmount = 0;
      for (const it of data.items) {
        const duplicate = await repo.findProductInPO(id, it.product_id, it.shade_id || null, null, tenantId);
        if (duplicate) throw new AppError(`Duplicate product in PO`, 400, 'DUPLICATE_PRODUCT');
        await repo.createPOItem({
          tenant_id: tenantId,
          purchase_order_id: id,
          product_id: it.product_id,
          shade_id: it.shade_id || null,
          ordered_boxes: it.ordered_boxes,
          ordered_pieces: it.ordered_pieces ?? 0,
          unit_price: it.unit_price,
          discount_pct: it.discount_pct ?? 0,
          tax_pct: it.tax_pct ?? 0,
        }, trx);
        totalAmount +=
          (parseFloat(it.ordered_boxes) || 0) * (parseFloat(it.unit_price) || 0) *
          (1 - (parseFloat(it.discount_pct) || 0) / 100) *
          (1 + (parseFloat(it.tax_pct) || 0) / 100);
      }
      await repo.updatePO(id, tenantId, { total_amount: totalAmount, grand_total: totalAmount, discount_amount: 0, tax_amount: 0 }, trx);
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

const approve = async (id, tenantId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');
  if (existing.status !== 'draft') {
    throw new AppError('Only draft purchase orders can be approved', 400, 'INVALID_STATUS');
  }
  await repo.setPOStatus(id, tenantId, 'confirmed');
  return getById(id, tenantId);
};

const remove = async (id, tenantId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');
  const grnCount = await repo.countGRNByPO(id, tenantId);
  if (grnCount > 0) {
    throw new AppError('Cannot delete purchase order with linked GRN', 400, 'GRN_EXISTS');
  }
  await repo.setPOStatus(id, tenantId, 'cancelled');
  return getById(id, tenantId);
};

const addItem = async (poId, tenantId, data) => {
  const po = await repo.findById(poId, tenantId);
  if (!po) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');
  if (po.status !== 'draft') throw new AppError('Cannot add items to non-draft PO', 400, 'INVALID_STATUS');
  const duplicate = await repo.findProductInPO(poId, data.product_id, data.shade_id || null, null, tenantId);
  if (duplicate) throw new AppError('Product already exists in this PO', 400, 'DUPLICATE_PRODUCT');
  await repo.createPOItem({
    tenant_id: tenantId,
    purchase_order_id: poId,
    ...data,
  });
  return getById(poId, tenantId);
};

const updateItem = async (poId, itemId, tenantId, data) => {
  const po = await repo.findById(poId, tenantId);
  if (!po) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');
  if (po.status !== 'draft') throw new AppError('Cannot edit items of non-draft PO', 400, 'INVALID_STATUS');
  const duplicate = await repo.findProductInPO(poId, data.product_id, data.shade_id || null, itemId, tenantId);
  if (duplicate) throw new AppError('Product already exists in this PO', 400, 'DUPLICATE_PRODUCT');
  await repo.updatePOItem(itemId, poId, tenantId, data);
  return getById(poId, tenantId);
};

const deleteItem = async (poId, itemId, tenantId) => {
  const po = await repo.findById(poId, tenantId);
  if (!po) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');
  if (po.status !== 'draft') throw new AppError('Cannot delete items from non-draft PO', 400, 'INVALID_STATUS');
  await repo.deletePOItem(itemId, poId, tenantId);
  return getById(poId, tenantId);
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  approve,
  remove,
  addItem,
  updateItem,
  deleteItem,
};
