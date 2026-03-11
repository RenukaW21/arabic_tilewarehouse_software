'use strict';
const repo = require('./repository');
const { generateDocNumber } = require('../../utils/docNumber');
const { beginTransaction } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');

// ─── CALCULATION HELPERS ──────────────────────────────────────────────────────

// Subtotal before discount/tax per item: boxes * unit_price
const calcSubtotal = (items) =>
  (items || []).reduce(
    (acc, it) =>
      acc + (parseFloat(it.ordered_boxes) || 0) * (parseFloat(it.unit_price) || 0),
    0
  );

// FIX #1 — sum per-item discount amounts
const calcDiscountAmount = (items) =>
  (items || []).reduce((acc, it) => {
    const base = (parseFloat(it.ordered_boxes) || 0) * (parseFloat(it.unit_price) || 0);
    return acc + base * ((parseFloat(it.discount_pct) || 0) / 100);
  }, 0);

// FIX #1 — sum per-item tax amounts (applied after per-item discount)
const calcTaxAmount = (items) =>
  (items || []).reduce((acc, it) => {
    const base = (parseFloat(it.ordered_boxes) || 0) * (parseFloat(it.unit_price) || 0);
    const afterDiscount = base * (1 - (parseFloat(it.discount_pct) || 0) / 100);
    return acc + afterDiscount * ((parseFloat(it.tax_pct) || 0) / 100);
  }, 0);

// FIX #1 — line total helper (discount then tax on each item)
const calcLineTotal = (it) =>
  (parseFloat(it.ordered_boxes) || 0) *
  (parseFloat(it.unit_price)    || 0) *
  (1 - (parseFloat(it.discount_pct) || 0) / 100) *
  (1 + (parseFloat(it.tax_pct)      || 0) / 100);

const sumItems = (items) => (items || []).reduce((acc, it) => acc + calcLineTotal(it), 0);

// ─── GRAND TOTAL ──────────────────────────────────────────────────────────────
// grand_total = sum of line totals - additional_discount
const calcGrandTotal = (items, additionalDiscount) => {
  const total = sumItems(items);
  return Math.max(0, total - (parseFloat(additionalDiscount) || 0));
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────
const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

// ─── GET BY ID ────────────────────────────────────────────────────────────────
const getById = async (id, tenantId) => {
  const po = await repo.findById(id, tenantId);
  if (!po) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');
  const items = await repo.findItemsByPOId(id, tenantId);
  return { ...po, items };
};

// ─── CREATE ───────────────────────────────────────────────────────────────────
const create = async (tenantId, userId, data) => {
  const poNumber = await generateDocNumber(tenantId, 'PO', 'PO');
  const trx = await beginTransaction();

  try {
    const additionalDiscount = parseFloat(data.additional_discount) || 0;
    const discountAmount     = calcDiscountAmount(data.items);
    const taxAmount          = calcTaxAmount(data.items);
    const totalAmount        = sumItems(data.items);
    const grandTotal         = Math.max(0, totalAmount - additionalDiscount);

    const poId = await repo.createPO(
      {
        tenant_id:           tenantId,
        po_number:           poNumber,
        vendor_id:           data.vendor_id,
        warehouse_id:        data.warehouse_id,
        order_date:          data.order_date,
        expected_date:       data.expected_date   || null,
        notes:               data.notes           || null,
        total_amount:        totalAmount,
        discount_amount:     discountAmount,       // FIX #1
        tax_amount:          taxAmount,            // FIX #1
        additional_discount: additionalDiscount,   // FIX #3
        grand_total:         grandTotal,
        created_by:          userId,
      },
      trx
    );

    for (const it of data.items || []) {
      const duplicate = await repo.findProductInPO(poId, it.product_id, it.shade_id || null, null, tenantId);
      if (duplicate) throw new AppError('Duplicate product in PO', 400, 'DUPLICATE_PRODUCT');

      await repo.createPOItem(
        {
          tenant_id:         tenantId,
          purchase_order_id: poId,
          product_id:        it.product_id,
          shade_id:          it.shade_id    || null,
          ordered_boxes:     it.ordered_boxes,
          ordered_pieces:    it.ordered_pieces ?? 0,
          unit_price:        it.unit_price,
          discount_pct:      it.discount_pct   ?? 0,
          tax_pct:           it.tax_pct         ?? 0,
        },
        trx
      );
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

// ─── UPDATE ───────────────────────────────────────────────────────────────────
const update = async (id, tenantId, data) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');

  const isDraft = existing.status === 'draft';
  const trx = await beginTransaction();

  try {
    // FIX #4 — received_date removed from draft-editable fields
    const headerFields = isDraft
      ? ['vendor_id', 'warehouse_id', 'order_date', 'expected_date', 'notes', 'additional_discount']
      : ['received_date', 'notes'];

    const payload = {};
    for (const key of headerFields) {
      if (data[key] !== undefined) payload[key] = data[key];
    }

    if (Object.keys(payload).length > 0) {
      await repo.updatePO(id, tenantId, payload, trx);
    }

    if (!isDraft) {
      await trx.commit();
      return getById(id, tenantId);
    }

    // Replace items only for draft
    if (Array.isArray(data.items)) {
      await repo.deleteAllPOItems(id, tenantId, trx);

      for (const it of data.items) {
        const duplicate = await repo.findProductInPO(id, it.product_id, it.shade_id || null, null, tenantId);
        if (duplicate) throw new AppError('Duplicate product in PO', 400, 'DUPLICATE_PRODUCT');

        await repo.createPOItem(
          {
            tenant_id:         tenantId,
            purchase_order_id: id,
            product_id:        it.product_id,
            shade_id:          it.shade_id    || null,
            ordered_boxes:     it.ordered_boxes,
            ordered_pieces:    it.ordered_pieces ?? 0,
            unit_price:        it.unit_price,
            discount_pct:      it.discount_pct   ?? 0,
            tax_pct:           it.tax_pct         ?? 0,
          },
          trx
        );
      }

      // FIX #1 — recalculate all totals properly after item replacement
      const additionalDiscount = parseFloat(data.additional_discount ?? existing.additional_discount) || 0;
      const discountAmount     = calcDiscountAmount(data.items);
      const taxAmount          = calcTaxAmount(data.items);
      const totalAmount        = sumItems(data.items);
      const grandTotal         = Math.max(0, totalAmount - additionalDiscount);

      await repo.updatePO(
        id,
        tenantId,
        {
          total_amount:        totalAmount,
          discount_amount:     discountAmount,
          tax_amount:          taxAmount,
          additional_discount: additionalDiscount,
          grand_total:         grandTotal,
        },
        trx
      );
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

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────
// FIX #2 — new service method to change PO status manually
const updateStatus = async (id, tenantId, status) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');

  // Protect against re-cancelling or setting received on a cancelled PO
  if (existing.status === 'cancelled' && status !== 'draft') {
    throw new AppError('Cancelled purchase orders can only be reverted to draft', 400, 'INVALID_STATUS');
  }

  await repo.setPOStatus(id, tenantId, status);
  return getById(id, tenantId);
};

// ─── APPROVE ──────────────────────────────────────────────────────────────────
const approve = async (id, tenantId, userId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');
  if (existing.status !== 'draft')
    throw new AppError('Only draft purchase orders can be approved', 400, 'INVALID_STATUS');

  await repo.setPOApproval(id, tenantId, userId);
  return getById(id, tenantId);
};

// ─── CANCEL / REMOVE ──────────────────────────────────────────────────────────
const remove = async (id, tenantId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');

  if (['received', 'cancelled'].includes(existing.status))
    throw new AppError(
      'Cannot cancel a received or already cancelled order',
      400,
      'INVALID_STATUS'
    );

  const grnCount = await repo.countGRNByPO(id, tenantId);
  if (grnCount > 0)
    throw new AppError('Cannot cancel purchase order with linked GRN', 400, 'GRN_EXISTS');

  await repo.setPOStatus(id, tenantId, 'cancelled');
  return getById(id, tenantId);
};

// ─── UPDATE PAYMENT STATUS ────────────────────────────────────────────────────
const updatePaymentStatus = async (id, tenantId, status) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');

  if (!['confirmed', 'partial', 'received'].includes(existing.status))
    throw new AppError(
      'Payment status can only be updated on confirmed or received orders',
      400,
      'INVALID_STATUS'
    );

  await repo.updatePO(id, tenantId, { payment_status: status });
  return getById(id, tenantId);
};

// ─── RECEIVE ITEM ─────────────────────────────────────────────────────────────
// FIX #6 — manually set received_boxes on a PO item with validation
const receiveItem = async (poId, itemId, tenantId, data) => {
  const po = await repo.findById(poId, tenantId);
  if (!po) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');

  const item = await repo.findPOItemById(itemId, poId, tenantId);
  if (!item) throw new AppError('PO item not found', 404, 'NOT_FOUND');

  const receivedBoxes = parseFloat(data.received_boxes) || 0;
  const orderedBoxes  = parseFloat(item.ordered_boxes)  || 0;

  // FIX #6 — enforce received_quantity ≤ ordered_quantity
  if (receivedBoxes > orderedBoxes) {
    throw new AppError(
      `received_boxes (${receivedBoxes}) cannot exceed ordered_boxes (${orderedBoxes})`,
      400,
      'VALIDATION_ERROR'
    );
  }

  await repo.updatePOItemReceivedBoxes(itemId, poId, tenantId, receivedBoxes);
  return getById(poId, tenantId);
};

// ─── ITEM OPERATIONS ──────────────────────────────────────────────────────────
const addItem = async (poId, tenantId, data) => {
  const po = await repo.findById(poId, tenantId);
  if (!po) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');
  if (po.status !== 'draft')
    throw new AppError('Cannot add items to non-draft PO', 400, 'INVALID_STATUS');

  const duplicate = await repo.findProductInPO(poId, data.product_id, data.shade_id || null, null, tenantId);
  if (duplicate) throw new AppError('Product already exists in this PO', 400, 'DUPLICATE_PRODUCT');

  await repo.createPOItem({ tenant_id: tenantId, purchase_order_id: poId, ...data });
  return getById(poId, tenantId);
};

const updateItem = async (poId, itemId, tenantId, data) => {
  const po = await repo.findById(poId, tenantId);
  if (!po) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');
  if (po.status !== 'draft')
    throw new AppError('Cannot edit items of non-draft PO', 400, 'INVALID_STATUS');

  const duplicate = await repo.findProductInPO(poId, data.product_id, data.shade_id || null, itemId, tenantId);
  if (duplicate) throw new AppError('Product already exists in this PO', 400, 'DUPLICATE_PRODUCT');

  await repo.updatePOItem(itemId, poId, tenantId, data);
  return getById(poId, tenantId);
};

const deleteItem = async (poId, itemId, tenantId) => {
  const po = await repo.findById(poId, tenantId);
  if (!po) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');
  if (po.status !== 'draft')
    throw new AppError('Cannot delete items from non-draft PO', 400, 'INVALID_STATUS');

  await repo.deletePOItem(itemId, poId, tenantId);
  return getById(poId, tenantId);
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  updateStatus,
  approve,
  remove,
  updatePaymentStatus,
  receiveItem,
  addItem,
  updateItem,
  deleteItem,
};
