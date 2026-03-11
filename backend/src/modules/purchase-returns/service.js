'use strict';
const repo = require('./repository');
const { generateDocNumber } = require('../../utils/docNumber');
const { beginTransaction } = require('../../config/db');
const { postStockMovement } = require('../../utils/stockHelper');
const { AppError } = require('../../middlewares/error.middleware');

const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const getById = async (id, tenantId) => {
  const pr = await repo.findById(id, tenantId);
  if (!pr) throw new AppError('Purchase return not found', 404, 'NOT_FOUND');
  const items = await repo.findItemsByReturnId(id, tenantId);
  return { ...pr, items };
};

/**
 * Create purchase return: insert header + items in one transaction.
 */
const create = async (tenantId, userId, data) => {
  const returnNumber = await generateDocNumber(tenantId, 'PR', 'PR');
  const totalBoxes = (data.items || []).reduce((sum, it) => sum + (parseFloat(it.returned_boxes) || 0), 0);

  const trx = await beginTransaction();
  try {
    const returnId = await repo.createReturn(
      {
        tenant_id:         tenantId,
        return_number:     returnNumber,
        purchase_order_id: data.purchase_order_id || null,
        grn_id:            data.grn_id            || null,
        vendor_id:         data.vendor_id,
        warehouse_id:      data.warehouse_id,
        return_date:       data.return_date,
        reason:            data.reason,
        status:            'draft',
        total_boxes:       totalBoxes,
        notes:             data.notes          || null,
        vehicle_number:    data.vehicle_number || null,
        created_by:        userId,
      },
      trx
    );

    for (const it of data.items || []) {
      await repo.createReturnItem(
        {
          tenant_id:          tenantId,
          purchase_return_id: returnId,
          grn_item_id:        it.grn_item_id    || null,
          product_id:         it.product_id,
          shade_id:           it.shade_id       || null,
          batch_id:           it.batch_id       || null,
          returned_boxes:     it.returned_boxes,
          returned_pieces:    it.returned_pieces ?? 0,
          unit_price:         it.unit_price,
          return_reason:      it.return_reason  || null,
        },
        trx
      );
    }

    await trx.commit();
    return getById(returnId, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

/**
 * Dispatch draft return: reduce stock and set status to dispatched.
 * FIX #13 — also updates purchase_order.return_status after dispatch.
 */
const dispatch = async (id, tenantId, userId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase return not found', 404, 'NOT_FOUND');
  if (existing.status !== 'draft') {
    throw new AppError('Only draft returns can be dispatched', 400, 'INVALID_STATUS');
  }
  const items = await repo.findItemsByReturnId(id, tenantId);

  const trx = await beginTransaction();
  try {
    for (const it of items) {
      const balance = await repo.getStockBalance(
        trx,
        tenantId,
        existing.warehouse_id,
        it.product_id,
        it.shade_id || null,
        it.batch_id || null
      );
      const available = parseFloat(balance.total_boxes) || 0;
      const returned  = parseFloat(it.returned_boxes)   || 0;
      if (returned > available) {
        throw new AppError(
          `Return quantity (${returned}) exceeds available stock (${available}) for product ${it.product_id}`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }

      const sqftPerBox = await repo.getProductSqftPerBox(trx, it.product_id, tenantId);
      await postStockMovement(trx, {
        tenantId,
        warehouseId:     existing.warehouse_id,
        rackId:          null,
        productId:       it.product_id,
        shadeId:         it.shade_id       || null,
        batchId:         it.batch_id       || null,
        transactionType: 'return',
        referenceId:     id,
        referenceType:   'purchase_return',
        boxesIn:         0,
        boxesOut:        returned,
        piecesIn:        0,
        piecesOut:       parseFloat(it.returned_pieces) || 0,
        sqftPerBox,
        unitPrice:       parseFloat(it.unit_price) || null,
        notes:           existing.reason || null,
        createdBy:       userId,
      });
    }

    await repo.updateReturnStatus(trx, id, tenantId, 'dispatched');

    // FIX #13 — update the linked PO's return_status after dispatch
    await repo.updatePOReturnStatus(trx, existing.purchase_order_id, tenantId);

    await trx.commit();
    return getById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

/**
 * Update only draft returns.
 * FIX #15 — now supports replacing items array if provided.
 */
const update = async (id, tenantId, data) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase return not found', 404, 'NOT_FOUND');
  if (existing.status !== 'draft') {
    throw new AppError('Only draft purchase returns can be updated', 400, 'INVALID_STATUS');
  }

  const trx = await beginTransaction();
  try {
    // Update header fields
    await repo.updateReturn(id, tenantId, data);

    // FIX #15 — replace items if provided
    if (Array.isArray(data.items) && data.items.length > 0) {
      await repo.deleteReturnItems(id, tenantId, trx);

      const totalBoxes = data.items.reduce((sum, it) => sum + (parseFloat(it.returned_boxes) || 0), 0);

      for (const it of data.items) {
        await repo.createReturnItem(
          {
            tenant_id:          tenantId,
            purchase_return_id: id,
            grn_item_id:        it.grn_item_id    || null,
            product_id:         it.product_id,
            shade_id:           it.shade_id       || null,
            batch_id:           it.batch_id       || null,
            returned_boxes:     it.returned_boxes,
            returned_pieces:    it.returned_pieces ?? 0,
            unit_price:         it.unit_price,
            return_reason:      it.return_reason  || null,
          },
          trx
        );
      }

      // Update total_boxes to reflect new items
      await repo.updateReturn(id, tenantId, { total_boxes: totalBoxes });
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

/** Delete draft return only. */
const remove = async (id, tenantId) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase return not found', 404, 'NOT_FOUND');
  if (existing.status !== 'draft') {
    throw new AppError('Only draft purchase returns can be deleted', 400, 'INVALID_STATUS');
  }
  const deleted = await repo.deleteReturn(id, tenantId);
  if (!deleted) throw new AppError('Return not found or not draft', 404, 'NOT_FOUND');
  return { id, deleted: true };
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  dispatch,
  remove,
};
