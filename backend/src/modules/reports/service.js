'use strict';
const { query } = require('../../config/db');

/**
 * GSTR-1 style GST report — invoice-wise tax summary
 */
const getGSTReport = async (tenantId, { month, year }) => {
  const m = parseInt(month) || new Date().getMonth() + 1;
  const y = parseInt(year) || new Date().getFullYear();

  const invoices = await query(
    `SELECT i.invoice_number, i.invoice_date, c.name AS customer_name,
            c.gstin AS customer_gstin, i.sub_total, i.cgst_amount, i.sgst_amount,
            i.igst_amount, i.grand_total
     FROM invoices i JOIN customers c ON i.customer_id = c.id
     WHERE i.tenant_id = ? AND i.status = 'issued'
       AND MONTH(i.invoice_date) = ? AND YEAR(i.invoice_date) = ?
     ORDER BY i.invoice_date`,
    [tenantId, m, y]
  );

  const hsn = await query(
    `SELECT ii.hsn_code, p.name AS product_name,
            SUM(ii.quantity_boxes) AS total_boxes,
            SUM(ii.taxable_amount) AS taxable_amount,
            SUM(ii.cgst_amount) AS cgst_amount,
            SUM(ii.sgst_amount) AS sgst_amount,
            SUM(ii.igst_amount) AS igst_amount
     FROM invoice_items ii
     JOIN invoices i ON ii.invoice_id = i.id
     JOIN products p ON ii.product_id = p.id
     WHERE ii.tenant_id = ? AND i.status = 'issued'
       AND MONTH(i.invoice_date) = ? AND YEAR(i.invoice_date) = ?
     GROUP BY ii.hsn_code, p.name`,
    [tenantId, m, y]
  );

  const summary = invoices.reduce((acc, inv) => ({
    totalInvoices: acc.totalInvoices + 1,
    taxableAmount: acc.taxableAmount + parseFloat(inv.sub_total),
    cgst: acc.cgst + parseFloat(inv.cgst_amount),
    sgst: acc.sgst + parseFloat(inv.sgst_amount),
    igst: acc.igst + parseFloat(inv.igst_amount),
    grandTotal: acc.grandTotal + parseFloat(inv.grand_total),
  }), { totalInvoices: 0, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, grandTotal: 0 });

  return { period: `${y}-${String(m).padStart(2, '0')}`, summary, invoices, hsnSummary: hsn };
};

/**
 * Revenue report — last N months trend
 */
const getRevenueReport = async (tenantId, { months = 12 } = {}) => {
  const monthly = await query(
    `SELECT DATE_FORMAT(invoice_date, '%Y-%m') AS month,
            COUNT(*) AS invoice_count,
            SUM(grand_total) AS revenue,
            SUM(cgst_amount + sgst_amount + igst_amount) AS tax_collected
     FROM invoices
     WHERE tenant_id = ? AND status = 'issued'
       AND invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
     ORDER BY month ASC`,
    [tenantId, months]
  );

  const topProducts = await query(
    `SELECT p.name, p.code, SUM(ii.quantity_boxes) AS boxes_sold, SUM(ii.line_total) AS revenue
     FROM invoice_items ii JOIN products p ON ii.product_id = p.id JOIN invoices i ON ii.invoice_id = i.id
     WHERE ii.tenant_id = ? AND i.status = 'issued'
       AND i.invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY p.id, p.name, p.code ORDER BY revenue DESC LIMIT 10`,
    [tenantId, months]
  );

  const topCustomers = await query(
    `SELECT c.name, c.code, SUM(i.grand_total) AS total_revenue, COUNT(*) AS invoice_count
     FROM invoices i JOIN customers c ON i.customer_id = c.id
     WHERE i.tenant_id = ? AND i.status = 'issued'
       AND i.invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY c.id, c.name, c.code ORDER BY total_revenue DESC LIMIT 10`,
    [tenantId, months]
  );

  return { monthly, topProducts, topCustomers };
};

/**
 * Accounts receivable aging report
 */
const getAgingReport = async (tenantId) => {
  const invoices = await query(
    `SELECT i.invoice_number, i.invoice_date, i.due_date, i.grand_total,
            i.payment_status, c.name AS customer_name, c.phone AS customer_phone,
            DATEDIFF(CURDATE(), i.due_date) AS days_overdue,
            (i.grand_total - COALESCE(paid.total_paid, 0)) AS outstanding
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     LEFT JOIN (
       SELECT invoice_id, SUM(amount) AS total_paid
       FROM customer_payments WHERE tenant_id = ? AND status = 'cleared'
       GROUP BY invoice_id
     ) paid ON paid.invoice_id = i.id
     WHERE i.tenant_id = ? AND i.status = 'issued' AND i.payment_status != 'paid'
     ORDER BY days_overdue DESC`,
    [tenantId, tenantId]
  );

  const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 0 };
  const customerBuckets = {};

  for (const inv of invoices) {
    const outstanding = parseFloat(inv.outstanding || 0);
    const days = parseInt(inv.days_overdue || 0);

    if (days <= 0)       buckets.current   += outstanding;
    else if (days <= 30) buckets.days1_30   += outstanding;
    else if (days <= 60) buckets.days31_60  += outstanding;
    else if (days <= 90) buckets.days61_90  += outstanding;
    else                 buckets.days90plus += outstanding;

    const cname = inv.customer_name;
    if (!customerBuckets[cname]) {
      customerBuckets[cname] = { customer: cname, phone: inv.customer_phone, current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 0, total: 0 };
    }
    customerBuckets[cname].total += outstanding;
    if (days <= 0)       customerBuckets[cname].current   += outstanding;
    else if (days <= 30) customerBuckets[cname].days1_30   += outstanding;
    else if (days <= 60) customerBuckets[cname].days31_60  += outstanding;
    else if (days <= 90) customerBuckets[cname].days61_90  += outstanding;
    else                 customerBuckets[cname].days90plus += outstanding;
  }

  return {
    summary: buckets,
    totalOutstanding: Object.values(buckets).reduce((a, b) => a + b, 0),
    customerWise: Object.values(customerBuckets).sort((a, b) => b.total - a.total),
    invoices,
  };
};

/**
 * Stock valuation report
 */
const getStockValuation = async (tenantId, warehouseId) => {
  const conditions = ['ss.tenant_id = ?'];
  const params = [tenantId];
  if (warehouseId) { conditions.push('ss.warehouse_id = ?'); params.push(warehouseId); }

  return query(
    `SELECT p.name AS product_name, p.code, p.size_label, p.hsn_code,
            w.name AS warehouse_name, ss.total_boxes, ss.total_sqft,
            ss.avg_cost_per_box,
            (ss.total_boxes * COALESCE(ss.avg_cost_per_box, 0)) AS total_value
     FROM stock_summary ss
     JOIN products p ON ss.product_id = p.id
     JOIN warehouses w ON ss.warehouse_id = w.id
     WHERE ${conditions.join(' AND ')} AND ss.total_boxes > 0
     ORDER BY total_value DESC`,
    params
  );
};

/**
 * Dashboard KPIs — legacy shape (kept for backward compatibility)
 */
const getDashboardKPIs = async (tenantId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todaySales, pendingOrders, lowStock, grnPending, monthRevenue, unpaidInvoices] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(grand_total), 0) AS total FROM sales_orders
       WHERE tenant_id = ? AND order_date >= ? AND order_date < ? AND status NOT IN ('cancelled','draft')`,
      [tenantId, today, tomorrow]
    ),
    query(`SELECT COUNT(*) AS total FROM sales_orders WHERE tenant_id = ? AND status IN ('draft','confirmed','pick_ready')`, [tenantId]),
    query(
      `SELECT COUNT(*) AS total FROM stock_summary ss JOIN products p ON ss.product_id = p.id
       WHERE ss.tenant_id = ? AND ss.total_boxes <= p.reorder_level_boxes AND ss.total_boxes >= 0`,
      [tenantId]
    ),
    query(`SELECT COUNT(*) AS total FROM grn WHERE tenant_id = ? AND status = 'draft'`, [tenantId]),
    query(
      `SELECT COALESCE(SUM(grand_total), 0) AS total FROM invoices
       WHERE tenant_id = ? AND status != 'cancelled' AND YEAR(invoice_date) = YEAR(CURDATE()) AND MONTH(invoice_date) = MONTH(CURDATE())`,
      [tenantId]
    ),
    query(
      `SELECT COALESCE(SUM(grand_total - COALESCE(p.paid, 0)), 0) AS total
       FROM invoices i
       LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM customer_payments WHERE tenant_id = ? AND status='cleared' GROUP BY invoice_id) p ON p.invoice_id = i.id
       WHERE i.tenant_id = ? AND i.status = 'issued' AND i.payment_status != 'paid'`,
      [tenantId, tenantId]
    ),
  ]);

  return {
    todaySales: todaySales[0].total,
    pendingOrders: pendingOrders[0].total,
    lowStockItems: lowStock[0].total,
    grnPending: grnPending[0].total,
    monthRevenue: monthRevenue[0].total,
    unpaidInvoices: unpaidInvoices[0].total,
  };
};

/**
 * Full dashboard payload in one optimized flow — single endpoint for UI.
 * Uses parallel aggregated queries; no N+1. All tenant-scoped.
 */
const getDashboard = async (tenantId) => {
  const [
    summaryRows,
    lowStockRows,
    recentSalesRows,
    recentPurchasesRows,
    stockByCategoryRows,
    recentGRNsRows,
    recentTransfersRows,
    ledgerSummaryRows,
  ] = await Promise.all([
    // Summary: counts and amounts in one round-trip per metric
    Promise.all([
      query(`SELECT COUNT(*) AS total FROM warehouses WHERE tenant_id = ? AND is_active = 1`, [tenantId]),
      query(`SELECT COUNT(*) AS total FROM products WHERE tenant_id = ? AND is_active = 1`, [tenantId]),
      query(`SELECT COUNT(*) AS total FROM vendors WHERE tenant_id = ? AND is_active = 1`, [tenantId]),
      query(`SELECT COUNT(*) AS total FROM customers WHERE tenant_id = ? AND is_active = 1`, [tenantId]),
      query(`SELECT COUNT(*) AS total FROM purchase_orders WHERE tenant_id = ? AND status IN ('draft','confirmed')`, [tenantId]),
      query(
        `SELECT COALESCE(SUM(ss.total_boxes), 0) AS total_boxes, COALESCE(SUM(ss.total_sqft), 0) AS total_sqft
         FROM stock_summary ss WHERE ss.tenant_id = ?`,
        [tenantId]
      ),
      query(
        `SELECT COALESCE(SUM(i.grand_total), 0) AS total
         FROM invoices i
         WHERE i.tenant_id = ? AND i.status = 'issued'
           AND YEAR(i.invoice_date) = YEAR(CURDATE()) AND MONTH(i.invoice_date) = MONTH(CURDATE())`,
        [tenantId]
      ),
      query(
        `SELECT COALESCE(SUM(po.grand_total), 0) AS total
         FROM purchase_orders po
         WHERE po.tenant_id = ? AND po.status IN ('confirmed','partial','received')
           AND YEAR(po.order_date) = YEAR(CURDATE()) AND MONTH(po.order_date) = MONTH(CURDATE())`,
        [tenantId]
      ),
    ]),
    // Low stock: from low_stock_alerts if any, else computed from stock_summary vs reorder_level
    (async () => {
      const fromAlerts = await query(
        `SELECT la.id, la.warehouse_id, la.product_id, la.shade_id, la.current_stock_boxes,
                la.reorder_level_boxes, la.status, la.alerted_at,
                p.code AS product_code, p.name AS product_name, p.reorder_level_boxes AS product_reorder
         FROM low_stock_alerts la
         JOIN products p ON p.id = la.product_id AND p.tenant_id = la.tenant_id
         WHERE la.tenant_id = ? AND la.status = 'open'
         ORDER BY la.alerted_at DESC LIMIT 10`,
        [tenantId]
      );
      if (fromAlerts.length > 0) return fromAlerts;
      return query(
        `SELECT ss.id, ss.warehouse_id, ss.product_id, ss.shade_id, ss.total_boxes AS current_stock_boxes,
                p.reorder_level_boxes AS reorder_level_boxes, 'open' AS status, NOW() AS alerted_at,
                p.code AS product_code, p.name AS product_name, p.reorder_level_boxes AS product_reorder
         FROM stock_summary ss
         JOIN products p ON p.id = ss.product_id AND p.tenant_id = ss.tenant_id
         WHERE ss.tenant_id = ? AND ss.total_boxes <= p.reorder_level_boxes AND ss.total_boxes >= 0
         ORDER BY ss.total_boxes ASC LIMIT 10`,
        [tenantId]
      );
    })(),
    // Recent sales: last 5 with customer name
    query(
      `SELECT so.id, so.so_number, so.order_date, so.status, so.grand_total, c.name AS customer_name
       FROM sales_orders so
       JOIN customers c ON c.id = so.customer_id AND c.tenant_id = so.tenant_id
       WHERE so.tenant_id = ?
       ORDER BY so.order_date DESC, so.created_at DESC LIMIT 5`,
      [tenantId]
    ),
    // Recent purchases: last 5 with vendor name
    query(
      `SELECT po.id, po.po_number, po.order_date, po.status, po.grand_total, v.name AS vendor_name
       FROM purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id AND v.tenant_id = po.tenant_id
       WHERE po.tenant_id = ?
       ORDER BY po.order_date DESC, po.created_at DESC LIMIT 5`,
      [tenantId]
    ),
    // Stock by category for pie chart
    query(
      `SELECT COALESCE(pc.name, 'Uncategorized') AS category, SUM(ss.total_boxes) AS boxes
       FROM stock_summary ss
       JOIN products p ON p.id = ss.product_id AND p.tenant_id = ss.tenant_id
       LEFT JOIN product_categories pc ON pc.id = p.category_id AND pc.tenant_id = p.tenant_id
       WHERE ss.tenant_id = ? AND ss.total_boxes > 0
       GROUP BY pc.id, COALESCE(pc.name, 'Uncategorized')
       ORDER BY boxes DESC`,
      [tenantId]
    ),
    // Recent GRNs (last 5 with vendor name)
    query(
      `SELECT g.id, g.grn_number, g.receipt_date, g.status, g.created_at, v.name AS vendor_name, w.name AS warehouse_name
       FROM grn g
       JOIN vendors v ON v.id = g.vendor_id AND v.tenant_id = g.tenant_id
       JOIN warehouses w ON w.id = g.warehouse_id AND w.tenant_id = g.tenant_id
       WHERE g.tenant_id = ?
       ORDER BY g.receipt_date DESC, g.created_at DESC LIMIT 5`,
      [tenantId]
    ),
    // Recent stock transfers (last 5 with from/to warehouse names)
    query(
      `SELECT st.id, st.transfer_number, st.transfer_date, st.status, st.created_at,
              fw.name AS from_warehouse_name, tw.name AS to_warehouse_name
       FROM stock_transfers st
       JOIN warehouses fw ON fw.id = st.from_warehouse_id AND fw.tenant_id = st.tenant_id
       JOIN warehouses tw ON tw.id = st.to_warehouse_id AND tw.tenant_id = st.tenant_id
       WHERE st.tenant_id = ?
       ORDER BY st.transfer_date DESC, st.created_at DESC LIMIT 5`,
      [tenantId]
    ),
    // Ledger summary: entry count (last 30 days) for activity indicator
    query(
      `SELECT COUNT(*) AS entry_count
       FROM stock_ledger
       WHERE tenant_id = ? AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      [tenantId]
    ),
  ]);

  const [warehousesCount, productsCount, vendorsCount, customersCount, pendingPOCount, stockRow, monthlySalesRow, monthlyPurchasesRow] = summaryRows;

  const ledgerSummary = ledgerSummaryRows[0];
  const summary = {
    totalWarehouses: Number(warehousesCount[0]?.total ?? 0),
    totalProducts: Number(productsCount[0]?.total ?? 0),
    totalVendors: Number(vendorsCount[0]?.total ?? 0),
    totalCustomers: Number(customersCount[0]?.total ?? 0),
    pendingPurchaseOrders: Number(pendingPOCount[0]?.total ?? 0),
    totalStock: Number(stockRow[0]?.total_boxes ?? 0),
    totalStockSqft: Number(stockRow[0]?.total_sqft ?? 0),
    monthlySales: Number(monthlySalesRow[0]?.total ?? 0),
    monthlyPurchases: Number(monthlyPurchasesRow[0]?.total ?? 0),
    ledgerEntriesLast30Days: Number(ledgerSummary?.entry_count ?? 0),
  };

  // Legacy KPI fields for existing consumers
  const kpis = await getDashboardKPIs(tenantId);

  return {
    summary,
    kpis: {
      todaySales: kpis.todaySales,
      pendingOrders: kpis.pendingOrders,
      lowStockItems: kpis.lowStockItems,
      activePOs: kpis.grnPending,
      monthRevenue: kpis.monthRevenue,
      unpaidInvoices: kpis.unpaidInvoices,
    },
    lowStock: lowStockRows,
    recentSales: recentSalesRows,
    recentPurchases: recentPurchasesRows,
    recentGRNs: recentGRNsRows,
    recentTransfers: recentTransfersRows,
    stockByCategory: stockByCategoryRows,
  };
};

module.exports = { getGSTReport, getRevenueReport, getAgingReport, getStockValuation, getDashboardKPIs, getDashboard };
