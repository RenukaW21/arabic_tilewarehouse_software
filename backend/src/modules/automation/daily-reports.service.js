'use strict';
/**
 * Automated Daily Reports Service
 *
 * Generates five daily warehouse reports:
 *   1. stock_movement  — all ledger entries for today
 *   2. inbound         — GRNs received today  
 *   3. outbound        — Sales orders dispatched today
 *   4. low_stock       — Items currently below reorder level
 *   5. summary         — Single KPI snapshot
 */
const { query } = require('../../config/db');

/**
 * Stock movement report for a given date (defaults to today).
 */
const getStockMovementReport = async (tenantId, date) => {
  const d = date || new Date().toISOString().split('T')[0];
  const rows = await query(
    `SELECT sl.id, sl.transaction_date, sl.transaction_type,
            p.name AS product_name, p.code AS product_code,
            w.name AS warehouse_name, r.name AS rack_name,
            sl.boxes_in, sl.boxes_out, sl.balance_boxes,
            sl.pieces_in, sl.pieces_out, sl.balance_pieces,
            sl.sqft_in, sl.sqft_out,
            sl.notes, sl.created_at
     FROM stock_ledger sl
     JOIN products p ON p.id = sl.product_id
     JOIN warehouses w ON w.id = sl.warehouse_id
     LEFT JOIN racks r ON r.id = sl.rack_id
     WHERE sl.tenant_id = ? AND DATE(sl.transaction_date) = ?
     ORDER BY sl.created_at ASC`,
    [tenantId, d]
  );
  return { date: d, count: rows.length, rows };
};

/**
 * Inbound report: GRNs received today (posted status).
 */
const getInboundReport = async (tenantId, date) => {
  const d = date || new Date().toISOString().split('T')[0];
  const grns = await query(
    `SELECT g.id, g.grn_number, g.receipt_date, g.status, g.grand_total,
            v.name AS vendor_name, w.name AS warehouse_name,
            COUNT(gi.id) AS item_count,
            COALESCE(SUM(gi.received_boxes), 0) AS total_boxes_received
     FROM grn g
     JOIN vendors v ON v.id = g.vendor_id
     JOIN warehouses w ON w.id = g.warehouse_id
     LEFT JOIN grn_items gi ON gi.grn_id = g.id
     WHERE g.tenant_id = ? AND DATE(g.receipt_date) = ? AND g.status = 'posted'
     GROUP BY g.id
     ORDER BY g.receipt_date ASC`,
    [tenantId, d]
  );

  const totalBoxes = grns.reduce((s, r) => s + parseFloat(r.total_boxes_received || 0), 0);
  return { date: d, count: grns.length, totalBoxesReceived: totalBoxes, rows: grns };
};

/**
 * Outbound report: Sales orders / delivery challans dispatched today.
 */
const getOutboundReport = async (tenantId, date) => {
  const d = date || new Date().toISOString().split('T')[0];
  const orders = await query(
    `SELECT so.id, so.so_number, so.order_date, so.status, so.grand_total,
            c.name AS customer_name,
            COUNT(soi.id) AS item_count,
            COALESCE(SUM(soi.quantity_boxes), 0) AS total_boxes_sold
     FROM sales_orders so
     JOIN customers c ON c.id = so.customer_id
     LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
     WHERE so.tenant_id = ? AND DATE(so.order_date) = ?
       AND so.status NOT IN ('draft', 'cancelled')
     GROUP BY so.id
     ORDER BY so.order_date ASC`,
    [tenantId, d]
  );

  const totalBoxes = orders.reduce((s, r) => s + parseFloat(r.total_boxes_sold || 0), 0);
  return { date: d, count: orders.length, totalBoxesSold: totalBoxes, rows: orders };
};

/**
 * Low stock report: Products currently below reorder level.
 */
const getLowStockReport = async (tenantId) => {
  const rows = await query(
    `SELECT p.id AS product_id, p.code, p.name AS product_name,
            p.reorder_level_boxes, p.size_label,
            COALESCE(pc.name, 'Uncategorised') AS category,
            w.id AS warehouse_id, w.name AS warehouse_name,
            ss.total_boxes AS current_stock,
            (p.reorder_level_boxes - ss.total_boxes) AS deficit_boxes
     FROM stock_summary ss
     JOIN products p ON p.id = ss.product_id AND p.tenant_id = ss.tenant_id
     JOIN warehouses w ON w.id = ss.warehouse_id
     LEFT JOIN product_categories pc ON pc.id = p.category_id
     WHERE ss.tenant_id = ?
       AND ss.total_boxes <= p.reorder_level_boxes
       AND ss.total_boxes >= 0
       AND p.is_active = 1
     ORDER BY deficit_boxes DESC`,
    [tenantId]
  );

  return {
    date: new Date().toISOString().split('T')[0],
    count: rows.length,
    rows,
  };
};

/**
 * Daily summary KPIs.
 */
const getDailySummary = async (tenantId, date) => {
  const d = date || new Date().toISOString().split('T')[0];

  const [movementCount, inboundCount, outboundCount, lowStockCount, totalStockBoxes] = await Promise.all([
    query(`SELECT COUNT(*) AS c FROM stock_ledger WHERE tenant_id = ? AND DATE(transaction_date) = ?`, [tenantId, d]),
    query(`SELECT COUNT(*) AS c, COALESCE(SUM(gi.received_boxes),0) AS boxes
           FROM grn g LEFT JOIN grn_items gi ON gi.grn_id = g.id
           WHERE g.tenant_id = ? AND DATE(g.receipt_date) = ? AND g.status = 'posted'`, [tenantId, d]),
    query(`SELECT COUNT(*) AS c, COALESCE(SUM(soi.quantity_boxes),0) AS boxes
           FROM sales_orders so LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
           WHERE so.tenant_id = ? AND DATE(so.order_date) = ? AND so.status NOT IN ('draft','cancelled')`, [tenantId, d]),
    query(`SELECT COUNT(*) AS c FROM stock_summary ss JOIN products p ON p.id = ss.product_id AND p.tenant_id = ss.tenant_id
           WHERE ss.tenant_id = ? AND ss.total_boxes <= p.reorder_level_boxes AND ss.total_boxes >= 0 AND p.is_active = 1`, [tenantId]),
    query(`SELECT COALESCE(SUM(total_boxes),0) AS total FROM stock_summary WHERE tenant_id = ?`, [tenantId]),
  ]);

  return {
    date: d,
    generatedAt: new Date().toISOString(),
    stockMovements: Number(movementCount[0]?.c ?? 0),
    inboundGRNs: Number(inboundCount[0]?.c ?? 0),
    inboundBoxes: Number(inboundCount[0]?.boxes ?? 0),
    outboundOrders: Number(outboundCount[0]?.c ?? 0),
    outboundBoxes: Number(outboundCount[0]?.boxes ?? 0),
    lowStockItems: Number(lowStockCount[0]?.c ?? 0),
    totalStockBoxes: Number(totalStockBoxes[0]?.total ?? 0),
  };
};

/**
 * Full daily report in one call.
 */
const getDailyReport = async (tenantId, dateStr) => {
  const [summary, stockMovement, inbound, outbound, lowStock] = await Promise.all([
    getDailySummary(tenantId, dateStr),
    getStockMovementReport(tenantId, dateStr),
    getInboundReport(tenantId, dateStr),
    getOutboundReport(tenantId, dateStr),
    getLowStockReport(tenantId),
  ]);
  return { summary, stockMovement, inbound, outbound, lowStock };
};

module.exports = {
  getStockMovementReport,
  getInboundReport,
  getOutboundReport,
  getLowStockReport,
  getDailySummary,
  getDailyReport,
};
