'use strict';

const { AppError } = require('../middlewares/error.middleware');
const logger = require('./logger');

const syncRackProductInventory = async (trx, { tenantId, rackId, productId }) => {
  if (!rackId || !productId) return;

  const rows = await trx.query(
    `SELECT COALESCE(SUM(total_boxes), 0) AS total_boxes
     FROM stock_summary
     WHERE tenant_id = ? AND rack_id = ? AND product_id = ? AND total_boxes > 0`,
    [tenantId, rackId, productId]
  );

  const totalBoxes = Math.max(0, parseFloat(rows[0]?.total_boxes) || 0);
  const storedBoxes = Math.round(totalBoxes);

  if (storedBoxes > 0) {
    await trx.query(
      `INSERT INTO product_racks (id, tenant_id, product_id, rack_id, boxes_stored)
       VALUES (UUID(), ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE boxes_stored = VALUES(boxes_stored), updated_at = CURRENT_TIMESTAMP`,
      [tenantId, productId, rackId, storedBoxes]
    );
  } else {
    await trx.query(
      `DELETE FROM product_racks
       WHERE tenant_id = ? AND product_id = ? AND rack_id = ?`,
      [tenantId, productId, rackId]
    );
  }

  await trx.query(
    `UPDATE racks r
     SET
       occupied_boxes = (
         SELECT COALESCE(SUM(pr.boxes_stored), 0)
         FROM product_racks pr
         JOIN products p ON pr.product_id = p.id
         WHERE pr.tenant_id = r.tenant_id AND pr.rack_id = r.id AND p.is_active = 1
       ),
       available_boxes = CASE
         WHEN r.capacity_boxes IS NULL THEN NULL
         ELSE r.capacity_boxes - (
           SELECT COALESCE(SUM(pr.boxes_stored), 0)
           FROM product_racks pr
           JOIN products p ON pr.product_id = p.id
           WHERE pr.tenant_id = r.tenant_id AND pr.rack_id = r.id AND p.is_active = 1
         )
       END
     WHERE r.id = ? AND r.tenant_id = ?`,
    [rackId, tenantId]
  );
};

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
  transactionType,    // grn|sale|transfer_in|transfer_out|damage|adjustment|return|opening|rack_assignment
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
  const prevBoxesNum = parseFloat(prev.total_boxes) || 0;

  logger.debug(`[STOCK] ${transactionType} | product:${productId} rack:${rackId ?? 'none'} ` +
    `batch:${batchId ?? 'none'} | before:${prevBoxesNum} in:${boxesIn} out:${boxesOut} ref:${referenceId}`);

  // Safety: prevent any deduction that would make stock negative
  if (boxesOut > 0 && prevBoxesNum + 1e-9 < boxesOut) {
    throw new AppError(
      `Insufficient stock in bin: need ${boxesOut} boxes, have ${prevBoxesNum} ` +
      `(product:${productId} rack:${rackId ?? 'unassigned'} batch:${batchId ?? 'none'} type:${transactionType}).`,
      400,
      'INSUFFICIENT_STOCK'
    );
  }

  if (rackId && boxesIn > boxesOut) {
    const netIncoming = boxesIn - boxesOut;
    const rackCheck = await trx.query(
      `SELECT name, capacity_boxes, occupied_boxes FROM racks WHERE id = ? AND tenant_id = ?`,
      [rackId, tenantId]
    );

    if (rackCheck.length > 0) {
      const r = rackCheck[0];
      if (r.capacity_boxes !== null) {
        const capacity = parseFloat(r.capacity_boxes);
        const occupied = parseFloat(r.occupied_boxes) || 0;
        
        if (occupied + netIncoming > capacity) {
          const available = capacity - occupied;
          throw new AppError(
            `Rack capacity exceeded: "${r.name}" can hold ${capacity} boxes (currently ${occupied} occupied, only ${available} available). Tried to add ${netIncoming} boxes. Please use the "Overflow Area" rack instead.`,
            400,
            'RACK_CAPACITY_EXCEEDED'
          );
        }
      }
    }
  }

  const balanceBoxes = Math.max(0, prevBoxesNum + boxesIn - boxesOut);
  const balancePieces = parseFloat(prev.total_pieces) + piecesIn - piecesOut;
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

  // 4 — Update NEW inventory table
  if (boxesIn > 0 || piecesIn > 0 || boxesOut > 0 || piecesOut > 0) {
    const existingInv = await trx.query(
      `SELECT id, boxes, pieces FROM inventory 
       WHERE tenant_id = ? AND product_id = ? AND (shade_id <=> ?) AND (rack_id <=> ?) AND (batch_id <=> ?) FOR UPDATE`,
      [tenantId, productId, shadeId, rackId, batchId]
    );

    if (existingInv.length > 0) {
      await trx.query(
        `UPDATE inventory SET boxes = boxes + ? - ?, pieces = pieces + ? - ? WHERE id = ?`,
        [boxesIn, boxesOut, piecesIn, piecesOut, existingInv[0].id]
      );
    } else if (boxesIn > 0 || piecesIn > 0) {
      await trx.query(
        `INSERT INTO inventory (id, tenant_id, product_id, shade_id, rack_id, batch_id, boxes, pieces)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, productId, shadeId, rackId, batchId, boxesIn, piecesIn]
      );
    }

    // 5 — Append to NEW stock_movements table
    const movementQty = (boxesIn - boxesOut) || (piecesIn - piecesOut); // Simplified for now, usually tracking boxes
    if (movementQty !== 0) {
        await trx.query(
          `INSERT INTO stock_movements (id, tenant_id, product_id, rack_id, movement_type, quantity, reference_id)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
          [tenantId, productId, rackId, transactionType, boxesIn - boxesOut, referenceId]
        );
    }
  }

  // 6 — Check for low stock alert
  await checkLowStockAlert(trx, { tenantId, warehouseId, productId, shadeId, balanceBoxes });

  if (rackId) {
    await syncRackProductInventory(trx, { tenantId, rackId, productId });
  }

  logger.debug(`[STOCK] ${transactionType} | product:${productId} rack:${rackId ?? 'none'} | after:${balanceBoxes}`);

  return { balanceBoxes, balancePieces };
};

/**
 * Create/resolve low stock alerts based on reorder level.
 */
const checkLowStockAlert = async (trx, { tenantId, warehouseId, productId, shadeId, balanceBoxes }) => {
  const products = await trx.query(
    `SELECT name, code, reorder_level_boxes FROM products WHERE id = ? AND tenant_id = ?`,
    [productId, tenantId]
  );
  if (!products.length) return;

  const product = products[0];
  const reorderLevel = product.reorder_level_boxes || 0;

  if (balanceBoxes <= reorderLevel) {
    // 1. Upsert low stock alert
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

    // 2. Only create a new notification if it was a transition to 'open' status
    // or if we want to notify on every stock change below level.
    // To keep it clean, let's notify when it's low.
    // Since notifications are per-user, we find all admins and managers for this tenant.
    const users = await trx.query(
      `SELECT id FROM users WHERE tenant_id = ? AND role IN ('admin', 'warehouse_manager') AND is_active = 1`,
      [tenantId]
    );

    const title = 'Low Stock Alert';
    const message = `Product ${product.code} (${product.name}) is low on stock. Current: ${balanceBoxes} boxes (Reorder level: ${reorderLevel}).`;

    for (const user of users) {
      await trx.query(
        `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, is_read, reference_id, created_at)
         VALUES (UUID(), ?, ?, 'warning', ?, ?, 0, ?, NOW())`,
        [tenantId, user.id, title, message, productId]
      );
    }
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

module.exports = { postStockMovement, syncRackProductInventory };
