'use strict';

/**
 * Two-step transfer execution.
 *
 * confirmTransfer  — Draft → In Transit
 *   Immediately deducts stock from from_warehouse (TRANSFER_OUT).
 *   Multi-bin spread when no from_rack_id specified (unracked bins first, then
 *   descending stock).  Marks emptied racks as vacant (rack_status = 'ACTIVE').
 *
 * receiveTransfer  — In Transit → Received
 *   Adds stock to to_warehouse (TRANSFER_IN).  Preserves avg_cost from source
 *   by passing unitPrice: null (stockHelper keeps the existing avg).
 *
 * Rules:
 *   - Stock is NEVER edited directly; only postStockMovement (ledger + summary).
 *   - Ledger entries are immutable (no delete).
 *   - Both functions are fully transactional.
 */

const { beginTransaction, query } = require('../../config/db');
const { postStockMovement } = require('../../utils/stockHelper');
const { AppError } = require('../../middlewares/error.middleware');

// ─── helpers ──────────────────────────────────────────────────────────────────

/** After a TRANSFER_OUT drains a rack to 0 occupied_boxes → mark it vacant. */
const markRackIfEmpty = async (trx, tenantId, rackId) => {
  if (!rackId) return;
  await trx.query(
    `UPDATE racks
     SET rack_status = CASE WHEN occupied_boxes = 0 THEN 'ACTIVE' ELSE rack_status END,
         updated_at  = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [rackId, tenantId]
  );
};

/**
 * Fetch transfer + items in one place so both confirm and receive share logic.
 * Returns { transfer, items }.
 */
const loadTransfer = async (transferId, tenantId) => {
  const rows = await query(
    `SELECT id, from_warehouse_id, to_warehouse_id, status, transfer_number
     FROM stock_transfers WHERE id = ? AND tenant_id = ?`,
    [transferId, tenantId]
  );
  if (!rows.length) throw new AppError('Stock transfer not found.', 404, 'NOT_FOUND');

  const items = await query(
    `SELECT sti.*, p.sqft_per_box
     FROM stock_transfer_items sti
     JOIN products p ON p.id = sti.product_id AND p.tenant_id = sti.tenant_id
     WHERE sti.transfer_id = ? AND sti.tenant_id = ?`,
    [transferId, tenantId]
  );
  if (!items.length) throw new AppError('Transfer has no items.', 400, 'NO_ITEMS');

  return { transfer: rows[0], items };
};

/**
 * Deduct one transfer-item's boxes from the source warehouse inside `trx`.
 *
 * When item.from_rack_id is set  → single-bin deduction from that exact bin.
 * When item.from_rack_id is null → multi-bin spread: unracked bins first,
 *   then bins by descending available stock, until the quantity is fulfilled.
 *
 * Calls markRackIfEmpty after each bin that was touched.
 */
const deductFromSource = async (trx, { tenantId, fromWh, item, transferId, transferNumber, sqftPerBox, userId }) => {
  const boxes  = parseFloat(item.transferred_boxes)  || 0;
  const pieces = parseFloat(item.transferred_pieces) || 0;
  if (boxes <= 0) return;

  const notes = `Transfer: ${transferNumber}`;

  if (item.from_rack_id) {
    // ── single-bin path ──────────────────────────────────────────────────────
    const [bin] = await trx.query(
      `SELECT id, total_boxes, avg_cost_per_box FROM stock_summary
       WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?
         AND (shade_id <=> ?) AND (batch_id <=> ?) AND (rack_id <=> ?)
       FOR UPDATE`,
      [tenantId, fromWh, item.product_id,
       item.shade_id || null, item.batch_id || null, item.from_rack_id]
    );

    if (!bin || parseFloat(bin.total_boxes) < boxes) {
      const available = bin ? parseFloat(bin.total_boxes) : 0;
      throw new AppError(
        `Insufficient stock for product ${item.product_id} in rack ${item.from_rack_id}: ` +
        `need ${boxes}, available ${available}.`,
        400, 'INSUFFICIENT_STOCK'
      );
    }

    await postStockMovement(trx, {
      tenantId,
      warehouseId: fromWh,
      rackId: item.from_rack_id,
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

    await markRackIfEmpty(trx, tenantId, item.from_rack_id);

  } else {
    // ── multi-bin path ───────────────────────────────────────────────────────
    // Unracked bins first (rack_id IS NULL = 0 sorts before 1), then desc stock.
    const bins = await trx.query(
      `SELECT id, rack_id, total_boxes, avg_cost_per_box FROM stock_summary
       WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?
         AND (shade_id <=> ?) AND (batch_id <=> ?) AND total_boxes > 0
       ORDER BY (rack_id IS NOT NULL), total_boxes DESC
       FOR UPDATE`,
      [tenantId, fromWh, item.product_id,
       item.shade_id || null, item.batch_id || null]
    );

    // Pre-flight: ensure aggregate stock covers the request
    const totalAvail = bins.reduce((s, b) => s + parseFloat(b.total_boxes), 0);
    if (totalAvail < boxes) {
      throw new AppError(
        `Insufficient stock for product ${item.product_id}: ` +
        `need ${boxes} boxes, only ${totalAvail} available across all bins in source warehouse.`,
        400, 'INSUFFICIENT_STOCK',
        'Verify stock levels in the source warehouse before confirming this transfer.'
      );
    }

    let remaining       = boxes;
    let remainingPieces = pieces;

    for (const bin of bins) {
      if (remaining <= 0) break;
      const binStock  = parseFloat(bin.total_boxes);
      const take      = Math.min(remaining, binStock);
      const takePieces = remaining > 0
        ? Math.round(remainingPieces * (take / remaining))
        : 0;

      await postStockMovement(trx, {
        tenantId,
        warehouseId: fromWh,
        rackId: bin.rack_id || null,
        productId: item.product_id,
        shadeId: item.shade_id || null,
        batchId: item.batch_id || null,
        transactionType: 'transfer_out',
        referenceId: transferId,
        referenceType: 'stock_transfer',
        boxesOut: take,
        piecesOut: takePieces,
        sqftPerBox,
        notes,
        createdBy: userId,
      });

      if (bin.rack_id) await markRackIfEmpty(trx, tenantId, bin.rack_id);

      remaining       -= take;
      remainingPieces -= takePieces;
    }
  }
};

// ─── public functions ──────────────────────────────────────────────────────────

/**
 * Confirm a draft transfer → In Transit.
 * Deducts stock from from_warehouse immediately.
 */
const confirmTransfer = async (transferId, tenantId, userId) => {
  const { transfer, items } = await loadTransfer(transferId, tenantId);

  if (transfer.status !== 'draft') {
    throw new AppError(
      `Transfer cannot be confirmed — current status is "${transfer.status}".`,
      400, 'INVALID_STATUS',
      'Only draft transfers can be confirmed.'
    );
  }

  const trx = await beginTransaction();
  try {
    for (const item of items) {
      const sqftPerBox = parseFloat(item.sqft_per_box) || 0;
      await deductFromSource(trx, {
        tenantId,
        fromWh: transfer.from_warehouse_id,
        item,
        transferId,
        transferNumber: transfer.transfer_number,
        sqftPerBox,
        userId,
      });
    }

    await trx.query(
      `UPDATE stock_transfers SET status = 'in_transit'
       WHERE id = ? AND tenant_id = ?`,
      [transferId, tenantId]
    );

    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }

  const [updated] = await query(
    `SELECT st.*, fw.name AS from_warehouse_name, tw.name AS to_warehouse_name
     FROM stock_transfers st
     LEFT JOIN warehouses fw ON fw.id = st.from_warehouse_id AND fw.tenant_id = st.tenant_id
     LEFT JOIN warehouses tw ON tw.id = st.to_warehouse_id AND tw.tenant_id = st.tenant_id
     WHERE st.id = ? AND st.tenant_id = ?`,
    [transferId, tenantId]
  );
  return updated;
};

/**
 * Receive an in-transit transfer → Received.
 * Adds stock to to_warehouse.  avg_cost is preserved (unitPrice: null).
 */
const receiveTransfer = async (transferId, tenantId, userId, notes = null) => {
  const { transfer, items } = await loadTransfer(transferId, tenantId);

  if (transfer.status !== 'in_transit') {
    throw new AppError(
      `Transfer cannot be received — current status is "${transfer.status}".`,
      400, 'INVALID_STATUS',
      'Only in-transit transfers can be marked as received.'
    );
  }

  const trx = await beginTransaction();
  try {
    for (const item of items) {
      const boxes      = parseFloat(item.transferred_boxes)  || 0;
      const pieces     = parseFloat(item.transferred_pieces) || 0;
      const sqftPerBox = parseFloat(item.sqft_per_box)       || 0;
      if (boxes <= 0) continue;

      await postStockMovement(trx, {
        tenantId,
        warehouseId: transfer.to_warehouse_id,
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
        unitPrice: null,   // preserves existing avg_cost at destination
        notes: `Transfer: ${transfer.transfer_number}`,
        createdBy: userId,
      });
    }

    const notesPart = notes !== null ? ', notes = ?' : '';
    const notesArg  = notes !== null ? [notes] : [];
    await trx.query(
      `UPDATE stock_transfers SET status = 'received', received_date = CURDATE()${notesPart}
       WHERE id = ? AND tenant_id = ?`,
      [...notesArg, transferId, tenantId]
    );

    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }

  const [updated] = await query(
    `SELECT st.*, fw.name AS from_warehouse_name, tw.name AS to_warehouse_name
     FROM stock_transfers st
     LEFT JOIN warehouses fw ON fw.id = st.from_warehouse_id AND fw.tenant_id = st.tenant_id
     LEFT JOIN warehouses tw ON tw.id = st.to_warehouse_id AND tw.tenant_id = st.tenant_id
     WHERE st.id = ? AND st.tenant_id = ?`,
    [transferId, tenantId]
  );
  return updated;
};

module.exports = { confirmTransfer, receiveTransfer };
