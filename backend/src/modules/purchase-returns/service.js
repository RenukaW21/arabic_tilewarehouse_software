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
 * Create purchase return: insert header + items, reduce stock via postStockMovement, all in one transaction.
 * No updating posted returns; no hard delete. Prevents negative stock.
 */
const create = async (tenantId, userId, data) => {
  const returnNumber = await generateDocNumber(tenantId, 'PR', 'PR');
  const totalBoxes = (data.items || []).reduce((sum, it) => sum + (parseFloat(it.returned_boxes) || 0), 0);

  const trx = await beginTransaction();
  try {
    const returnId = await repo.createReturn(
      {
        tenant_id: tenantId,
        return_number: returnNumber,
        purchase_order_id: data.purchase_order_id || null,
        grn_id: data.grn_id || null,
        vendor_id: data.vendor_id,
        warehouse_id: data.warehouse_id,
        return_date: data.return_date,
        reason: data.reason,
        status: 'dispatched',
        total_boxes: totalBoxes,
        notes: data.notes || null,
        vehicle_number: data.vehicle_number || null,
        created_by: userId,
      },
      trx
    );

    for (const it of data.items || []) {
      const balance = await repo.getStockBalance(
        trx,
        tenantId,
        data.warehouse_id,
        it.product_id,
        it.shade_id || null,
        it.batch_id || null
      );
      const available = parseFloat(balance.total_boxes) || 0;
      const returned = parseFloat(it.returned_boxes) || 0;
      if (returned > available) {
        throw new AppError(
          `Return quantity (${returned}) exceeds available stock (${available}) for product ${it.product_id}`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }

      await repo.createReturnItem(
        {
          tenant_id: tenantId,
          purchase_return_id: returnId,
          grn_item_id: it.grn_item_id || null,
          product_id: it.product_id,
          shade_id: it.shade_id || null,
          batch_id: it.batch_id || null,
          returned_boxes: it.returned_boxes,
          returned_pieces: it.returned_pieces ?? 0,
          unit_price: it.unit_price,
          return_reason: it.return_reason || null,
        },
        trx
      );

      const sqftPerBox = await repo.getProductSqftPerBox(trx, it.product_id, tenantId);
      await postStockMovement(trx, {
        tenantId,
        warehouseId: data.warehouse_id,
        rackId: null,
        productId: it.product_id,
        shadeId: it.shade_id || null,
        batchId: it.batch_id || null,
        transactionType: 'return',
        referenceId: returnId,
        referenceType: 'purchase_return',
        boxesIn: 0,
        boxesOut: returned,
        piecesIn: 0,
        piecesOut: parseFloat(it.returned_pieces) || 0,
        sqftPerBox,
        unitPrice: parseFloat(it.unit_price) || null,
        notes: data.reason || null,
        createdBy: userId,
      });
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

/** Update only draft returns; no editing after dispatched. */
const update = async (id, tenantId, data) => {
  const existing = await repo.findById(id, tenantId);
  if (!existing) throw new AppError('Purchase return not found', 404, 'NOT_FOUND');
  if (existing.status !== 'draft') {
    throw new AppError('Only draft purchase returns can be updated', 400, 'INVALID_STATUS');
  }
  await repo.updateReturn(id, tenantId, data);
  return getById(id, tenantId);
};

module.exports = {
  getAll,
  getById,
  create,
  update,
};
