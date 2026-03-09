'use strict';

/**
 * Transfer execution — transaction-safe stock move.
 * Stock is NEVER directly edited; only postStockMovement (ledger + summary) is used.
 * Ledger entries are immutable (no delete).
 */
const { beginTransaction } = require('../../config/db');
const { postStockMovement } = require('../../utils/stockHelper');
const { AppError } = require('../../middlewares/error.middleware');

/**
 * Execute (dispatch) a stock transfer: move stock from from_warehouse to to_warehouse.
 * - TRANSFER_OUT at source warehouse
 * - TRANSFER_IN at destination warehouse
 * - Transfer status → in_transit
 * Rollback on any failure.
 *
 * @param {string} transferId - stock_transfers.id
 * @param {string} tenantId - from JWT
 * @param {string} userId - from JWT (created_by for ledger)
 */
const executeTransfer = async (transferId, tenantId, userId) => {
  const { query } = require('../../config/db');

  const transfers = await query(
    `SELECT id, from_warehouse_id, to_warehouse_id, status, transfer_number
     FROM stock_transfers WHERE id = ? AND tenant_id = ?`,
    [transferId, tenantId]
  );
  if (!transfers.length) throw new AppError('Transfer not found', 404, 'NOT_FOUND');
  const transfer = transfers[0];
  if (transfer.status !== 'draft') {
    throw new AppError(`Transfer cannot be executed in status: ${transfer.status}`, 400, 'INVALID_STATUS');
  }

  const items = await query(
    `SELECT sti.*, p.sqft_per_box
     FROM stock_transfer_items sti
     JOIN products p ON p.id = sti.product_id AND p.tenant_id = sti.tenant_id
     WHERE sti.transfer_id = ? AND sti.tenant_id = ?`,
    [transferId, tenantId]
  );
  if (!items.length) throw new AppError('Transfer has no items', 400, 'NO_ITEMS');

  const trx = await beginTransaction();
  try {
    for (const item of items) {
      const boxes = parseFloat(item.transferred_boxes) || 0;
      const pieces = parseFloat(item.transferred_pieces) || 0;
      const sqftPerBox = parseFloat(item.sqft_per_box) || 0;
      if (boxes <= 0) continue;

      const fromWh = transfer.from_warehouse_id;
      const toWh = transfer.to_warehouse_id;
      const notes = `Transfer: ${transfer.transfer_number}`;

      // 1) Check source has enough stock (lock row)
      const [sourceSummary] = await trx.query(
        `SELECT id, total_boxes, avg_cost_per_box FROM stock_summary
         WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?
           AND (shade_id <=> ?) AND (batch_id <=> ?) AND (rack_id <=> ?)
         FOR UPDATE`,
        [tenantId, fromWh, item.product_id, item.shade_id || null, item.batch_id || null, item.from_rack_id || null]
      );
      if (!sourceSummary || parseFloat(sourceSummary.total_boxes) < boxes) {
        await trx.rollback();
        trx.release();
        throw new AppError(
          `Insufficient stock for product in source warehouse (transfer ${transfer.transfer_number})`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }
      const unitPriceForReceive = parseFloat(sourceSummary.avg_cost_per_box) || null;

      // 2) TRANSFER_OUT at source
      await postStockMovement(trx, {
        tenantId,
        warehouseId: fromWh,
        rackId: item.from_rack_id || null,
        productId: item.product_id,
        shadeId: item.shade_id || null,
        batchId: item.batch_id || null,
        transactionType: 'transfer_out',
        referenceId: transferId,
        referenceType: 'stock_transfer',
        boxesOut: boxes,
        piecesOut: pieces,
        sqftPerBox,
        notes,
        createdBy: userId,
      });

      // 3) TRANSFER_IN at destination (preserve cost)
      await postStockMovement(trx, {
        tenantId,
        warehouseId: toWh,
        rackId: item.to_rack_id || null,
        productId: item.product_id,
        shadeId: item.shade_id || null,
        batchId: item.batch_id || null,
        transactionType: 'transfer_in',
        referenceId: transferId,
        referenceType: 'stock_transfer',
        boxesIn: boxes,
        piecesIn: pieces,
        sqftPerBox,
        unitPrice: unitPriceForReceive,
        notes,
        createdBy: userId,
      });
    }

    await trx.query(
      `UPDATE stock_transfers SET status = 'in_transit', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [transferId, tenantId]
    );

    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }

  return query(
    `SELECT st.*, fw.name AS from_warehouse_name, tw.name AS to_warehouse_name
     FROM stock_transfers st
     JOIN warehouses fw ON fw.id = st.from_warehouse_id AND fw.tenant_id = st.tenant_id
     JOIN warehouses tw ON tw.id = st.to_warehouse_id AND tw.tenant_id = st.tenant_id
     WHERE st.id = ? AND st.tenant_id = ?`,
    [transferId, tenantId]
  ).then((rows) => rows[0]);
};

module.exports = { executeTransfer };
