'use strict';
const { query } = require('../../config/db');

/**
 * GSTR-1 style GST report — invoice-wise tax summary
 * Optional warehouseId: limit to invoices tied to sales orders for that warehouse.
 */
const getGSTReport = async (tenantId, { month, year, warehouseId } = {}) => {
  const m = parseInt(month) || new Date().getMonth() + 1;
  const y = parseInt(year) || new Date().getFullYear();
  const wh = warehouseId ?? null;

  const invoices = await query(
    `SELECT i.invoice_number, i.invoice_date, c.name AS customer_name,
            c.gstin AS customer_gstin, i.sub_total, i.cgst_amount, i.sgst_amount,
            i.igst_amount, i.grand_total
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = i.tenant_id
     WHERE i.tenant_id = ? AND i.status = 'issued'
       AND MONTH(i.invoice_date) = ? AND YEAR(i.invoice_date) = ?
       AND (? IS NULL OR so.warehouse_id = ?)
     ORDER BY i.invoice_date`,
    [tenantId, m, y, wh, wh]
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
     JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = i.tenant_id
     JOIN products p ON ii.product_id = p.id
     WHERE ii.tenant_id = ? AND i.status = 'issued'
       AND MONTH(i.invoice_date) = ? AND YEAR(i.invoice_date) = ?
       AND (? IS NULL OR so.warehouse_id = ?)
     GROUP BY ii.hsn_code, p.name`,
    [tenantId, m, y, wh, wh]
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
const getRevenueReport = async (tenantId, { months = 12, warehouseId } = {}) => {
  const m = months;
  const wh = warehouseId ?? null;

  const monthly = await query(
    `SELECT DATE_FORMAT(i.invoice_date, '%Y-%m') AS month,
            COUNT(*) AS invoice_count,
            SUM(i.grand_total) AS revenue,
            SUM(i.cgst_amount + i.sgst_amount + i.igst_amount) AS tax_collected
     FROM invoices i
     JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = i.tenant_id
     WHERE i.tenant_id = ? AND i.status = 'issued'
       AND i.invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       AND (? IS NULL OR so.warehouse_id = ?)
     GROUP BY DATE_FORMAT(i.invoice_date, '%Y-%m')
     ORDER BY month ASC`,
    [tenantId, m, wh, wh]
  );

  const topProducts = await query(
    `SELECT p.name, p.code, SUM(ii.quantity_boxes) AS boxes_sold, SUM(ii.line_total) AS revenue
     FROM invoice_items ii
     JOIN products p ON ii.product_id = p.id
     JOIN invoices i ON ii.invoice_id = i.id
     JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = i.tenant_id
     WHERE ii.tenant_id = ? AND i.status = 'issued'
       AND i.invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       AND (? IS NULL OR so.warehouse_id = ?)
     GROUP BY p.id, p.name, p.code ORDER BY revenue DESC LIMIT 10`,
    [tenantId, m, wh, wh]
  );

  const topCustomers = await query(
    `SELECT c.name, c.code, SUM(i.grand_total) AS total_revenue, COUNT(*) AS invoice_count
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = i.tenant_id
     WHERE i.tenant_id = ? AND i.status = 'issued'
       AND i.invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       AND (? IS NULL OR so.warehouse_id = ?)
     GROUP BY c.id, c.name, c.code ORDER BY total_revenue DESC LIMIT 10`,
    [tenantId, m, wh, wh]
  );

  return { monthly, topProducts, topCustomers };
};

/**
 * Accounts receivable aging report
 */
const getAgingReport = async (tenantId, warehouseId = null) => {
  const wh = warehouseId ?? null;
  const invoices = await query(
    `SELECT i.invoice_number, i.invoice_date, i.due_date, i.grand_total,
            i.payment_status, c.name AS customer_name, c.phone AS customer_phone,
            DATEDIFF(CURDATE(), i.due_date) AS days_overdue,
            (i.grand_total - COALESCE(paid.total_paid, 0)) AS outstanding
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = i.tenant_id
     LEFT JOIN (
       SELECT invoice_id, SUM(amount) AS total_paid
       FROM customer_payments WHERE tenant_id = ? AND status = 'cleared'
       GROUP BY invoice_id
     ) paid ON paid.invoice_id = i.id
     WHERE i.tenant_id = ? AND i.status = 'issued' AND i.payment_status != 'paid'
       AND (? IS NULL OR so.warehouse_id = ?)
     ORDER BY days_overdue DESC`,
    [tenantId, tenantId, wh, wh]
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
const getDashboardKPIs = async (tenantId, warehouseId = null) => {
  const wh = warehouseId ?? null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todaySales, pendingOrders, lowStock, grnPending, monthRevenue, unpaidInvoices] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(so.grand_total), 0) AS total FROM sales_orders so
       WHERE so.tenant_id = ? AND so.order_date >= ? AND so.order_date < ? AND so.status NOT IN ('cancelled','draft')
       AND (? IS NULL OR so.warehouse_id = ?)`,
      [tenantId, today, tomorrow, wh, wh]
    ),
    query(
      `SELECT COUNT(*) AS total FROM sales_orders so WHERE so.tenant_id = ? AND so.status IN ('draft','confirmed','pick_ready')
       AND (? IS NULL OR so.warehouse_id = ?)`,
      [tenantId, wh, wh]
    ),
    query(
      `SELECT COUNT(*) AS total FROM stock_summary ss JOIN products p ON ss.product_id = p.id
       WHERE ss.tenant_id = ? AND ss.total_boxes <= p.reorder_level_boxes AND ss.total_boxes >= 0
       AND (? IS NULL OR ss.warehouse_id = ?)`,
      [tenantId, wh, wh]
    ),
    query(
      `SELECT COUNT(*) AS total FROM grn g WHERE g.tenant_id = ? AND g.status = 'draft'
       AND (? IS NULL OR g.warehouse_id = ?)`,
      [tenantId, wh, wh]
    ),
    query(
      `SELECT COALESCE(SUM(i.grand_total), 0) AS total FROM invoices i
       JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = i.tenant_id
       WHERE i.tenant_id = ? AND i.status != 'cancelled' AND YEAR(i.invoice_date) = YEAR(CURDATE()) AND MONTH(i.invoice_date) = MONTH(CURDATE())
       AND (? IS NULL OR so.warehouse_id = ?)`,
      [tenantId, wh, wh]
    ),
    query(
      `SELECT COALESCE(SUM(i.grand_total - COALESCE(p.paid, 0)), 0) AS total
       FROM invoices i
       JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = i.tenant_id
       LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM customer_payments WHERE tenant_id = ? AND status='cleared' GROUP BY invoice_id) p ON p.invoice_id = i.id
       WHERE i.tenant_id = ? AND i.status = 'issued' AND i.payment_status != 'paid'
       AND (? IS NULL OR so.warehouse_id = ?)`,
      [tenantId, tenantId, wh, wh]
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
 * Optional warehouseId: limit metrics to that warehouse (sales/orders/GRN/stock tied to warehouse).
 */
const getDashboard = async (tenantId, { warehouseId } = {}) => {
  const wh = warehouseId ?? null;

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
      query(
        `SELECT COUNT(*) AS total FROM warehouses WHERE tenant_id = ? AND is_active = 1
         AND (? IS NULL OR id = ?)`,
        [tenantId, wh, wh]
      ),
      query(`SELECT COUNT(*) AS total FROM products WHERE tenant_id = ? AND is_active = 1`, [tenantId]),
      query(`SELECT COUNT(*) AS total FROM vendors WHERE tenant_id = ? AND is_active = 1`, [tenantId]),
      query(`SELECT COUNT(*) AS total FROM customers WHERE tenant_id = ? AND is_active = 1`, [tenantId]),
      query(
        `SELECT COUNT(*) AS total FROM purchase_orders po WHERE po.tenant_id = ? AND po.status IN ('draft','confirmed')
         AND (? IS NULL OR po.warehouse_id = ?)`,
        [tenantId, wh, wh]
      ),
      query(
        `SELECT COALESCE(SUM(ss.total_boxes), 0) AS total_boxes, COALESCE(SUM(ss.total_sqft), 0) AS total_sqft
         FROM stock_summary ss WHERE ss.tenant_id = ?
         AND (? IS NULL OR ss.warehouse_id = ?)`,
        [tenantId, wh, wh]
      ),
      query(
        `SELECT COALESCE(SUM(i.grand_total), 0) AS total
         FROM invoices i
         JOIN sales_orders so ON i.sales_order_id = so.id AND so.tenant_id = i.tenant_id
         WHERE i.tenant_id = ? AND i.status = 'issued'
           AND YEAR(i.invoice_date) = YEAR(CURDATE()) AND MONTH(i.invoice_date) = MONTH(CURDATE())
           AND (? IS NULL OR so.warehouse_id = ?)`,
        [tenantId, wh, wh]
      ),
      query(
        `SELECT COALESCE(SUM(po.grand_total), 0) AS total
         FROM purchase_orders po
         WHERE po.tenant_id = ? AND po.status IN ('confirmed','partial','received')
           AND YEAR(po.order_date) = YEAR(CURDATE()) AND MONTH(po.order_date) = MONTH(CURDATE())
           AND (? IS NULL OR po.warehouse_id = ?)`,
        [tenantId, wh, wh]
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
           AND (? IS NULL OR la.warehouse_id = ?)
         ORDER BY la.alerted_at DESC LIMIT 10`,
        [tenantId, wh, wh]
      );
      if (fromAlerts.length > 0) return fromAlerts;
      return query(
        `SELECT ss.id, ss.warehouse_id, ss.product_id, ss.shade_id, ss.total_boxes AS current_stock_boxes,
                p.reorder_level_boxes AS reorder_level_boxes, 'open' AS status, NOW() AS alerted_at,
                p.code AS product_code, p.name AS product_name, p.reorder_level_boxes AS product_reorder
         FROM stock_summary ss
         JOIN products p ON p.id = ss.product_id AND p.tenant_id = ss.tenant_id
         WHERE ss.tenant_id = ? AND ss.total_boxes <= p.reorder_level_boxes AND ss.total_boxes >= 0
           AND (? IS NULL OR ss.warehouse_id = ?)
         ORDER BY ss.total_boxes ASC LIMIT 10`,
        [tenantId, wh, wh]
      );
    })(),
    // Recent sales: last 5 with customer name
    query(
      `SELECT so.id, so.so_number, so.order_date, so.status, so.grand_total, c.name AS customer_name
       FROM sales_orders so
       JOIN customers c ON c.id = so.customer_id AND c.tenant_id = so.tenant_id
       WHERE so.tenant_id = ?
         AND (? IS NULL OR so.warehouse_id = ?)
       ORDER BY so.order_date DESC, so.created_at DESC LIMIT 5`,
      [tenantId, wh, wh]
    ),
    // Recent purchases: last 5 with vendor name
    query(
      `SELECT po.id, po.po_number, po.order_date, po.status, po.grand_total, v.name AS vendor_name
       FROM purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id AND v.tenant_id = po.tenant_id
       WHERE po.tenant_id = ?
         AND (? IS NULL OR po.warehouse_id = ?)
       ORDER BY po.order_date DESC, po.created_at DESC LIMIT 5`,
      [tenantId, wh, wh]
    ),
    // Stock by category for pie chart
    query(
      `SELECT COALESCE(pc.name, 'Uncategorized') AS category, SUM(ss.total_boxes) AS boxes
       FROM stock_summary ss
       JOIN products p ON p.id = ss.product_id AND p.tenant_id = ss.tenant_id
       LEFT JOIN product_categories pc ON pc.id = p.category_id AND pc.tenant_id = p.tenant_id
       WHERE ss.tenant_id = ? AND ss.total_boxes > 0
         AND (? IS NULL OR ss.warehouse_id = ?)
       GROUP BY pc.id, COALESCE(pc.name, 'Uncategorized')
       ORDER BY boxes DESC`,
      [tenantId, wh, wh]
    ),
    // Recent GRNs (last 5 with vendor name)
    query(
      `SELECT g.id, g.grn_number, g.receipt_date, g.status, g.created_at, v.name AS vendor_name, w.name AS warehouse_name
       FROM grn g
       JOIN vendors v ON v.id = g.vendor_id AND v.tenant_id = g.tenant_id
       JOIN warehouses w ON w.id = g.warehouse_id AND w.tenant_id = g.tenant_id
       WHERE g.tenant_id = ?
         AND (? IS NULL OR g.warehouse_id = ?)
       ORDER BY g.receipt_date DESC, g.created_at DESC LIMIT 5`,
      [tenantId, wh, wh]
    ),
    // Recent stock transfers (last 5 with from/to warehouse names)
    query(
      `SELECT st.id, st.transfer_number, st.transfer_date, st.status, st.created_at,
              fw.name AS from_warehouse_name, tw.name AS to_warehouse_name
       FROM stock_transfers st
       JOIN warehouses fw ON fw.id = st.from_warehouse_id AND fw.tenant_id = st.tenant_id
       JOIN warehouses tw ON tw.id = st.to_warehouse_id AND tw.tenant_id = st.tenant_id
       WHERE st.tenant_id = ?
         AND (? IS NULL OR st.from_warehouse_id = ? OR st.to_warehouse_id = ?)
       ORDER BY st.transfer_date DESC, st.created_at DESC LIMIT 5`,
      [tenantId, wh, wh, wh]
    ),
    // Ledger summary: entry count (last 30 days) for activity indicator
    query(
      `SELECT COUNT(*) AS entry_count
       FROM stock_ledger sl
       WHERE sl.tenant_id = ? AND sl.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         AND (? IS NULL OR sl.warehouse_id = ?)`,
      [tenantId, wh, wh]
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
  const kpis = await getDashboardKPIs(tenantId, wh);

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

// ─── Inventory Consumption Report ────────────────────────────────────────────

const CONSUMPTION_TYPES = ['sale', 'damage', 'adjustment', 'transfer_out', 'production_material'];

const getInventoryConsumptionReport = async (tenantId, { from, to, productId, warehouseId, transactionType } = {}) => {
  const conditions = ['sl.tenant_id = ?', 'sl.boxes_out > 0'];
  const params = [tenantId];

  if (from)            { conditions.push('sl.transaction_date >= ?'); params.push(from); }
  if (to)              { conditions.push('sl.transaction_date <= ?'); params.push(to); }
  if (productId)       { conditions.push('sl.product_id = ?');        params.push(productId); }
  if (warehouseId)     { conditions.push('sl.warehouse_id = ?');      params.push(warehouseId); }
  if (transactionType) { conditions.push('sl.transaction_type = ?');  params.push(transactionType); }
  else {
    // default: show all OUT-movement types meaningful for consumption
    conditions.push(`sl.transaction_type IN (${CONSUMPTION_TYPES.map(() => '?').join(',')})`);
    params.push(...CONSUMPTION_TYPES);
  }

  const where = conditions.join(' AND ');

  const rows = await query(
    `SELECT
       sl.id,
       sl.transaction_date,
       sl.transaction_type,
       sl.reference_id,
       sl.reference_type,
       sl.boxes_out       AS qty_consumed,
       sl.sqft_out        AS sqft_consumed,
       sl.balance_boxes,
       sl.notes,
       p.id               AS product_id,
       p.name             AS product_name,
       p.code             AS product_code,
       p.hsn_code,
       p.size_label,
       w.id               AS warehouse_id,
       w.name             AS warehouse_name,
       COALESCE(cost.avg_cost, 0) AS unit_cost,
       ROUND(sl.boxes_out * COALESCE(cost.avg_cost, 0), 2) AS total_value
     FROM stock_ledger sl
     JOIN products   p ON sl.product_id   = p.id
     JOIN warehouses w ON sl.warehouse_id = w.id
     LEFT JOIN (
       SELECT product_id, warehouse_id, AVG(avg_cost_per_box) AS avg_cost
       FROM   stock_summary
       WHERE  tenant_id = ?
       GROUP  BY product_id, warehouse_id
     ) cost ON cost.product_id = sl.product_id AND cost.warehouse_id = sl.warehouse_id
     WHERE ${where}
     ORDER BY sl.transaction_date DESC, sl.id DESC`,
    [tenantId, ...params]
  );

  // summary aggregates
  const summary = rows.reduce((acc, r) => {
    acc.totalQtyConsumed  += parseFloat(r.qty_consumed  || 0);
    acc.totalSqftConsumed += parseFloat(r.sqft_consumed || 0);
    acc.totalValue        += parseFloat(r.total_value   || 0);
    acc.uniqueProducts.add(r.product_id);
    return acc;
  }, { totalQtyConsumed: 0, totalSqftConsumed: 0, totalValue: 0, uniqueProducts: new Set() });

  return {
    summary: {
      totalQtyConsumed:  +summary.totalQtyConsumed.toFixed(2),
      totalSqftConsumed: +summary.totalSqftConsumed.toFixed(2),
      totalValue:        +summary.totalValue.toFixed(2),
      uniqueProducts:    summary.uniqueProducts.size,
      totalRows:         rows.length,
    },
    rows,
  };
};

const exportInventoryConsumptionExcel = async (tenantId, filters) => {
  const ExcelJS = require('exceljs');
  const { summary, rows } = await getInventoryConsumptionReport(tenantId, filters);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tiles WMS';
  wb.created = new Date();

  // ── Summary sheet ────────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Consumption Report');

  // Title row
  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Inventory Consumption Report';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // Filters row
  const filterParts = [];
  if (filters.from || filters.to) filterParts.push(`Period: ${filters.from || '—'} to ${filters.to || '—'}`);
  if (filters.transactionType)    filterParts.push(`Type: ${filters.transactionType}`);

  ws.mergeCells('A2:J2');
  ws.getCell('A2').value = filterParts.length ? filterParts.join('   |   ') : 'All periods & movement types';
  ws.getCell('A2').font  = { italic: true, color: { argb: 'FF555555' } };
  ws.getRow(2).height = 18;

  // Summary KPI row headers
  const kpiLabels = ['Total Qty Consumed (boxes)', 'Total Sqft Consumed', 'Total Value (₹)', 'Unique Products', 'Total Entries'];
  const kpiValues = [summary.totalQtyConsumed, summary.totalSqftConsumed, summary.totalValue, summary.uniqueProducts, summary.totalRows];

  for (let i = 0; i < kpiLabels.length; i++) {
    const col = i * 2 + 1;
    const labelCell = ws.getCell(4, col);
    labelCell.value = kpiLabels[i];
    labelCell.font  = { bold: true, size: 9, color: { argb: 'FF374151' } };
    labelCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    labelCell.border = { bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } } };

    const valCell = ws.getCell(5, col);
    valCell.value = kpiValues[i];
    valCell.font  = { bold: true, size: 11 };
    if (i === 2) valCell.numFmt = '₹#,##0.00';
    else         valCell.numFmt = '#,##0.##';
  }
  ws.getRow(4).height = 22;
  ws.getRow(5).height = 22;

  // Column headers row
  const headerRow = ws.addRow([]);
  const headers = [
    { header: '#',              width: 6  },
    { header: 'Date',          width: 14 },
    { header: 'Product Code',  width: 14 },
    { header: 'Product Name',  width: 28 },
    { header: 'Warehouse',     width: 20 },
    { header: 'Movement Type', width: 18 },
    { header: 'Qty Consumed\n(boxes)', width: 16 },
    { header: 'Sqft Consumed', width: 14 },
    { header: 'Unit Cost (₹)', width: 14 },
    { header: 'Total Value (₹)', width: 16 },
  ];

  ws.columns = headers.map((h, i) => ({ key: String(i + 1), width: h.width }));

  const headerDataRow = ws.getRow(7);
  headers.forEach((h, i) => {
    const cell = headerDataRow.getCell(i + 1);
    cell.value = h.header;
    cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF1E40AF' } } };
  });
  headerDataRow.height = 30;

  // Data rows
  rows.forEach((r, idx) => {
    const row = ws.addRow([
      idx + 1,
      r.transaction_date ? new Date(r.transaction_date).toLocaleDateString('en-IN') : '',
      r.product_code,
      r.product_name,
      r.warehouse_name,
      r.transaction_type,
      +parseFloat(r.qty_consumed  || 0).toFixed(2),
      +parseFloat(r.sqft_consumed || 0).toFixed(2),
      +parseFloat(r.unit_cost     || 0).toFixed(2),
      +parseFloat(r.total_value   || 0).toFixed(2),
    ]);

    const isEven = idx % 2 === 1;
    const bg = isEven ? 'FFF8FAFF' : 'FFFFFFFF';
    row.eachCell((cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
      if (colNum >= 7) cell.numFmt = '#,##0.##';
      if (colNum === 10) cell.numFmt = '₹#,##0.00';
      cell.alignment = { vertical: 'middle', horizontal: colNum <= 4 ? 'left' : 'center' };
    });
  });

  // Totals row
  const totalsRow = ws.addRow([
    '', 'TOTAL', '', '', '', '',
    +summary.totalQtyConsumed.toFixed(2),
    +summary.totalSqftConsumed.toFixed(2),
    '',
    +summary.totalValue.toFixed(2),
  ]);
  totalsRow.eachCell((cell, colNum) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    if (colNum === 10) cell.numFmt = '₹#,##0.00';
    if (colNum === 7 || colNum === 8) cell.numFmt = '#,##0.##';
    cell.border = { top: { style: 'medium', color: { argb: 'FF1E40AF' } } };
  });

  return wb;
};

module.exports = {
  getGSTReport, getRevenueReport, getAgingReport, getStockValuation,
  getDashboardKPIs, getDashboard,
  getInventoryConsumptionReport, exportInventoryConsumptionExcel,
};
