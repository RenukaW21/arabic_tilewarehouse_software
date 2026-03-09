'use strict';

/**
 * Post a stock movement within an existing transaction.
 * Updates stock_summary (upsert) and appends to stock_ledger.
 *
 * @param {Object} trx - active transaction object from beginTransaction()
 * @param {Object} opts
 */
const postStockMovement = async (trx, {
  tenantId,
  warehouseId,
  rackId = null,
  productId,
  shadeId = null,
  batchId = null,
  transactionType,    // grn|sale|transfer_in|transfer_out|damage|adjustment|return|opening
  referenceId = null,
  referenceType = null,
  boxesIn = 0,
  boxesOut = 0,
  piecesIn = 0,
  piecesOut = 0,
  sqftPerBox = 0,
  unitPrice = null,
  notes = null,
  createdBy,
}) => {
  // 1 — Get current balance from stock_summary (lock row for update)
  const summary = await trx.query(
    `SELECT id, total_boxes, total_pieces, total_sqft, avg_cost_per_box
     FROM stock_summary
     WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?
       AND (shade_id <=> ?) AND (batch_id <=> ?) AND (rack_id <=> ?)
     FOR UPDATE`,
    [tenantId, warehouseId, productId, shadeId, batchId, rackId]
  );

  const prev = summary[0] || { total_boxes: 0, total_pieces: 0, total_sqft: 0, avg_cost_per_box: 0 };
  const balanceBoxes = parseFloat(prev.total_boxes) + boxesIn - boxesOut;
  const balancePieces = parseFloat(prev.total_pieces) + piecesIn - piecesOut;
  if (balanceBoxes < 0 || balancePieces < 0) {
    throw new Error(`Insufficient stock: cannot post ${boxesOut} boxes / ${piecesOut} pieces (balance would be ${balanceBoxes} / ${balancePieces})`);
  }
  const sqftIn = boxesIn * sqftPerBox;
  const sqftOut = boxesOut * sqftPerBox;
  const totalSqft = parseFloat(prev.total_sqft || 0) + sqftIn - sqftOut;

  // Weighted average cost: (prev_stock * prev_cost + incoming * unit_price) / new_stock
  const prevAvgCost = parseFloat(prev.avg_cost_per_box || 0);
  const prevBoxes = parseFloat(prev.total_boxes || 0);
  let newAvgCost = prevAvgCost;
  if (boxesIn > 0 && typeof unitPrice === 'number' && unitPrice > 0) {
    const totalCostBefore = prevBoxes * prevAvgCost;
    const incomingCost = boxesIn * unitPrice;
    newAvgCost = balanceBoxes > 0 ? (totalCostBefore + incomingCost) / balanceBoxes : 0;
  }

  // 2 — Upsert stock_summary
  if (summary.length === 0) {
    await trx.query(
      `INSERT INTO stock_summary
         (id, tenant_id, warehouse_id, rack_id, product_id, shade_id, batch_id,
          total_boxes, total_pieces, total_sqft, avg_cost_per_box, updated_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [tenantId, warehouseId, rackId, productId, shadeId, batchId,
       balanceBoxes, balancePieces, totalSqft, newAvgCost]
    );
  } else {
    await trx.query(
      `UPDATE stock_summary
       SET total_boxes = ?, total_pieces = ?, total_sqft = ?, avg_cost_per_box = ?, updated_at = NOW()
       WHERE id = ?`,
      [balanceBoxes, balancePieces, totalSqft, newAvgCost, summary[0].id]
    );
  }

  // 3 — Append to stock_ledger
  await trx.query(
    `INSERT INTO stock_ledger
       (id, tenant_id, warehouse_id, rack_id, product_id, shade_id, batch_id,
        transaction_type, reference_id, reference_type,
        boxes_in, boxes_out, pieces_in, pieces_out,
        balance_boxes, balance_pieces, sqft_in, sqft_out,
        transaction_date, created_by, created_at, notes)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, NOW(), ?)`,
    [tenantId, warehouseId, rackId, productId, shadeId, batchId,
     transactionType, referenceId, referenceType,
     boxesIn, boxesOut, piecesIn, piecesOut,
     balanceBoxes, balancePieces, sqftIn, sqftOut,
     createdBy, notes]
  );

  // 4 — Check for low stock alert
  await checkLowStockAlert(trx, { tenantId, warehouseId, productId, shadeId, balanceBoxes });

  return { balanceBoxes, balancePieces };
};

/**
 * Create/resolve low stock alerts based on reorder level.
 */
const checkLowStockAlert = async (trx, { tenantId, warehouseId, productId, shadeId, balanceBoxes }) => {
  const products = await trx.query(
    `SELECT reorder_level_boxes FROM products WHERE id = ? AND tenant_id = ?`,
    [productId, tenantId]
  );
  if (!products.length) return;

  const reorderLevel = products[0].reorder_level_boxes || 0;

  if (balanceBoxes <= reorderLevel) {
    // Upsert low stock alert
    await trx.query(
      `INSERT INTO low_stock_alerts
         (id, tenant_id, warehouse_id, product_id, shade_id,
          current_stock_boxes, reorder_level_boxes, status, alerted_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, 'open', NOW())
       ON DUPLICATE KEY UPDATE
         current_stock_boxes = VALUES(current_stock_boxes),
         status = 'open',
         alerted_at = NOW()`,
      [tenantId, warehouseId, productId, shadeId, balanceBoxes, reorderLevel]
    );
  } else {
    // Resolve existing alert if stock is back above reorder level
    await trx.query(
      `UPDATE low_stock_alerts SET status = 'resolved', resolved_at = NOW()
       WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?
         AND (shade_id <=> ?) AND status = 'open'`,
      [tenantId, warehouseId, productId, shadeId]
    );
  }
};

module.exports = { postStockMovement };
