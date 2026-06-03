'use strict';

const { AppError } = require('../middlewares/error.middleware');

async function getPhysicalStock(trx, tenantId, warehouseId, productId, shadeId, batchId) {
  // When shade/batch not specified on the SO line, sum across all shade/batch variants
  // (matches how the inventory page aggregates stock). When specified, match exactly.
  const conditions = ['tenant_id = ?', 'warehouse_id = ?', 'product_id = ?'];
  const params = [tenantId, warehouseId, productId];
  if (shadeId) { conditions.push('(shade_id <=> ?)'); params.push(shadeId); }
  if (batchId) { conditions.push('(batch_id <=> ?)'); params.push(batchId); }

  const rows = await trx.query(
    `SELECT COALESCE(SUM(total_boxes), 0) AS total_boxes FROM stock_summary WHERE ${conditions.join(' AND ')}`,
    params
  );
  return parseFloat(rows[0]?.total_boxes) || 0;
}

/** Sum of reservations for this SKU in warehouse, excluding one sales order (for ATP checks). */
async function getReservedByOthers(trx, tenantId, warehouseId, productId, shadeId, batchId, excludeSalesOrderId) {
  const conditions = [
    'tenant_id = ?', 'warehouse_id = ?', 'product_id = ?', 'sales_order_id != ?',
  ];
  const params = [tenantId, warehouseId, productId, excludeSalesOrderId];
  if (shadeId) { conditions.push('(shade_id <=> ?)'); params.push(shadeId); }
  if (batchId) { conditions.push('(batch_id <=> ?)'); params.push(batchId); }

  const rows = await trx.query(
    `SELECT COALESCE(SUM(boxes_reserved), 0) AS r FROM stock_reservations WHERE ${conditions.join(' AND ')}`,
    params
  );
  return parseFloat(rows[0]?.r) || 0;
}

/**
 * Replace reservation rows for a sales order (confirm / re-sync).
 * Each sales_order_item_id has at most one row.
 */
async function replaceReservationsForSalesOrder(trx, tenantId, salesOrderId, warehouseId, items) {
  await trx.query(
    'DELETE FROM stock_reservations WHERE tenant_id = ? AND sales_order_id = ?',
    [tenantId, salesOrderId]
  );

  for (const item of items) {
    const boxes = parseFloat(item.ordered_boxes) || 0;
    if (boxes <= 0) continue;

    const physical = await getPhysicalStock(
      trx, tenantId, warehouseId, item.product_id, item.shade_id, item.batch_id
    );
    const reservedOthers = await getReservedByOthers(
      trx, tenantId, warehouseId, item.product_id, item.shade_id, item.batch_id, salesOrderId
    );
    const atp = physical - reservedOthers;
    if (boxes > atp + 1e-6) {
      throw new AppError(
        `Insufficient stock to reserve for line: need ${boxes} boxes, available to promise ${atp}`,
        400,
        'INSUFFICIENT_STOCK'
      );
    }

    await trx.query(
      `INSERT INTO stock_reservations
         (id, tenant_id, sales_order_id, sales_order_item_id, warehouse_id, product_id, shade_id, batch_id, boxes_reserved, created_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        tenantId,
        salesOrderId,
        item.id,
        warehouseId,
        item.product_id,
        item.shade_id || null,
        item.batch_id || null,
        boxes,
      ]
    );
  }
}

async function deleteReservationsForSalesOrder(trx, tenantId, salesOrderId) {
  await trx.query(
    'DELETE FROM stock_reservations WHERE tenant_id = ? AND sales_order_id = ?',
    [tenantId, salesOrderId]
  );
}

/**
 * Release reserved quantity when goods are dispatched (stock_summary is reduced separately).
 */
async function releaseReservationForDispatchLine(trx, tenantId, {
  salesOrderId,
  salesOrderItemId,
  productId,
  shadeId,
  batchId,
  boxes,
}) {
  const qty = parseFloat(boxes) || 0;
  if (qty <= 0) return;

  if (salesOrderItemId) {
    await trx.query(
      `UPDATE stock_reservations
       SET boxes_reserved = boxes_reserved - ?
       WHERE tenant_id = ? AND sales_order_item_id = ?`,
      [qty, tenantId, salesOrderItemId]
    );
    await trx.query(
      `DELETE FROM stock_reservations
       WHERE tenant_id = ? AND sales_order_item_id = ? AND boxes_reserved <= 0.0001`,
      [tenantId, salesOrderItemId]
    );
    return;
  }

  const rows = await trx.query(
    `SELECT id, boxes_reserved FROM stock_reservations
     WHERE tenant_id = ? AND sales_order_id = ? AND product_id = ?
       AND (shade_id <=> ?) AND (batch_id <=> ?)
     ORDER BY created_at
     FOR UPDATE`,
    [tenantId, salesOrderId, productId, shadeId || null, batchId || null]
  );

  let remaining = qty;
  for (const row of rows) {
    if (remaining <= 0) break;
    const br = parseFloat(row.boxes_reserved) || 0;
    if (br <= 0) continue;
    const take = Math.min(remaining, br);
    await trx.query(
      `UPDATE stock_reservations SET boxes_reserved = boxes_reserved - ? WHERE id = ?`,
      [take, row.id]
    );
    remaining -= take;
    await trx.query(
      `DELETE FROM stock_reservations WHERE id = ? AND boxes_reserved <= 0.0001`,
      [row.id]
    );
  }
}

module.exports = {
  getPhysicalStock,
  getReservedByOthers,
  replaceReservationsForSalesOrder,
  deleteReservationsForSalesOrder,
  releaseReservationForDispatchLine,
};
