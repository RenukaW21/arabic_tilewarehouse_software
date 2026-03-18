'use strict';
const repo = require('./repository');
const { generateDocNumber } = require('../../utils/docNumber');
const { beginTransaction, query } = require('../../config/db');
const { AppError } = require('../../middlewares/error.middleware');
const productService = require('../products/service');
const { postStockMovement } = require('../../utils/stockHelper');
const grnRepo = require('../grn/repository');

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
      if (!it.product_id && it.product_name) {
        const dummyCode = `AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newProd = await productService.create(tenantId, {
          name: it.product_name,
          code: dummyCode,
          sizeLengthMm: 0,
          sizeWidthMm: 0,
          sizeLabel: 'Custom',
          piecesPerBox: 1,
          sqftPerBox: 1,
          gstRate: it.tax_pct || 18,
          mrp: it.unit_price || 0,
          isActive: false, // Create as inactive until received
        });
        it.product_id = newProd.id;
      } else if (it.product_id && it.ordered_pieces) {
        // Update pieces per box for existing product if provided
        await productService.update(it.product_id, tenantId, {
          piecesPerBox: it.ordered_pieces
        });
      }

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
        if (!it.product_id && it.product_name) {
          const dummyCode = `AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const newProd = await productService.create(tenantId, {
            name: it.product_name,
            code: dummyCode,
            sizeLengthMm: 0,
            sizeWidthMm: 0,
            sizeLabel: 'Custom',
            piecesPerBox: 1,
            sqftPerBox: 1,
            gstRate: it.tax_pct || 18,
            mrp: it.unit_price || 0,
            isActive: false, // Create as inactive until received
          });
          it.product_id = newProd.id;
        } else if (it.product_id && it.ordered_pieces) {
          // Update pieces per box for existing product if provided
          await productService.update(it.product_id, tenantId, {
            piecesPerBox: it.ordered_pieces
          });
        }

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
// When status is set to 'received' manually:
//   1. Auto-create a GRN with all PO items (ordered_boxes = received_boxes)
//   2. Mark quality as 'pass'
//   3. Auto-post the GRN (posts stock movements)
//   4. Activate any auto-created products
const updateStatus = async (id, tenantId, status, userId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');

  // Protect against re-cancelling or setting received on a cancelled PO
  if (existing.status === 'cancelled' && status !== 'draft') {
    throw new AppError('Cancelled purchase orders can only be reverted to draft', 400, 'INVALID_STATUS');
  }

  if (status === 'received') {
    // Check if GRN already exists for this PO
    const existingGRNs = await grnRepo.findAll(tenantId, { purchase_order_id: id, limit: 1 });
    const hasGRN = existingGRNs.rows && existingGRNs.rows.length > 0;

    if (!hasGRN) {
      // ── 1. Create draft GRN ──────────────────────────────────────────────
      const poItems = await repo.findItemsByPOId(id, tenantId);
      const grnNumber = await generateDocNumber(tenantId, 'GRN', 'GRN');
      const trx = await beginTransaction();

      try {
        const grnId = await grnRepo.createGRN(trx, {
          tenantId,
          grnNumber,
          purchaseOrderId: id,
          vendorId: existing.vendor_id,
          warehouseId: existing.warehouse_id,
          receiptDate: new Date(),
          notes: `Auto-generated from PO ${existing.po_number}`,
          createdBy: userId || null,
        });

        for (const item of poItems) {
          // Fetch purchase_order_item_id
          const poiRows = await trx.query(
            `SELECT id FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ? AND (shade_id <=> ?) AND tenant_id = ? LIMIT 1`,
            [id, item.product_id, item.shade_id || null, tenantId]
          );
          const purchase_order_item_id = poiRows.length ? poiRows[0].id : null;

          await grnRepo.createGRNItem(trx, {
            tenantId,
            grnId,
            purchase_order_item_id,
            product_id: item.product_id,
            shade_id: item.shade_id || null,
            batch_id: null,
            batch_number: null,
            rack_id: null,
            received_boxes: item.ordered_boxes,  // full ordered qty received
            received_pieces: item.ordered_pieces || 0,
            damaged_boxes: 0,
            unit_price: item.unit_price,
            quality_status: 'pass',             // auto-pass quality
            quality_notes: null,
          });
        }

        await grnRepo.recalcGrandTotal(grnId, tenantId, trx);

        // ── 2. Auto-post GRN (stock movements) ──────────────────────────────
        for (const item of poItems) {
          const netBoxes = parseFloat(item.ordered_boxes) || 0;
          if (netBoxes > 0) {
            const productRows = await trx.query(
              'SELECT sqft_per_box FROM products WHERE id = ? AND tenant_id = ?',
              [item.product_id, tenantId]
            );
            const sqftPerBox = productRows[0] ? parseFloat(productRows[0].sqft_per_box) || 0 : 0;

            await postStockMovement(trx, {
              tenantId,
              warehouseId: existing.warehouse_id,
              rackId: null,
              productId: item.product_id,
              shadeId: item.shade_id || null,
              batchId: null,
              transactionType: 'grn',
              referenceId: grnId,
              referenceType: 'grn',
              boxesIn: netBoxes,
              piecesIn: parseFloat(item.ordered_pieces || 0),
              sqftPerBox,
              notes: `Auto GRN: ${grnNumber}`,
              createdBy: userId || null,
            });
          }
        }

        // Mark GRN as posted
        await grnRepo.updateStatus(trx, grnId, tenantId, 'posted');
        await grnRepo.recalcGrandTotal(grnId, tenantId, trx);
        await grnRepo.updatePOReceivedBoxes(trx, id, tenantId);

        // ── 3. Activate auto-created products ───────────────────────────────
        for (const item of poItems) {
          await productService.update(item.product_id, tenantId, { isActive: true });
        }

        await trx.commit();
      } catch (err) {
        await trx.rollback();
        throw err;
      } finally {
        trx.release();
      }
    } else {
      // GRN already exists — just activate products
      const items = await repo.findItemsByPOId(id, tenantId);
      for (const item of items) {
        await productService.update(item.product_id, tenantId, { isActive: true });
      }
      await repo.setPOStatus(id, tenantId, status);
    }
    return getById(id, tenantId);
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
const updatePaymentStatus = async (id, tenantId, status, userId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase order not found', 404, 'NOT_FOUND');

  if (!['confirmed', 'partial', 'received'].includes(existing.status))
    throw new AppError(
      'Payment status can only be updated on confirmed or received orders',
      400,
      'INVALID_STATUS'
    );

  await repo.updatePO(id, tenantId, { payment_status: status });

  // AUTOMATIC PAYMENT RECORD CREATION
  if (status === 'paid') {
    const { v4: uuidv4 } = require('uuid');
    
    // Check if a payment for this PO already exists
    const existingPayments = await query(
      'SELECT id FROM vendor_payments WHERE purchase_order_id = ? AND tenant_id = ? AND status != "cancelled"',
      [id, tenantId]
    );

    if (existingPayments.length === 0) {
      const paymentId = uuidv4();
      const paymentNumber = `VP-AUTO-${existing.po_number}`;
      
      await query(`
        INSERT INTO vendor_payments (
          id, tenant_id, payment_number, vendor_id, purchase_order_id, 
          payment_date, amount, payment_mode, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
      `, [
        paymentId,
        tenantId,
        paymentNumber,
        existing.vendor_id,
        id,
        existing.grand_total,
        'other',
        'cleared',
        'Auto-generated on PO Completion',
        userId || existing.created_by
      ]);
    }
  }

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
