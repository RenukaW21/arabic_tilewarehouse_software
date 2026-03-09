// ─── Report Types ─────────────────────────────────────────────────────────────

/** Single optimized dashboard API response (GET /reports/dashboard) */
export interface DashboardData {
  summary: {
    totalWarehouses: number;
    totalProducts: number;
    totalVendors: number;
    totalCustomers: number;
    pendingPurchaseOrders: number;
    totalStock: number;
    totalStockSqft: number;
    monthlySales: number;
    monthlyPurchases: number;
    ledgerEntriesLast30Days: number;
  };
  kpis: {
    todaySales: number;
    pendingOrders: number;
    lowStockItems: number;
    activePOs: number;
    monthRevenue: number;
    unpaidInvoices: number;
  };
  lowStock: DashboardLowStockItem[];
  recentSales: DashboardRecentSale[];
  recentPurchases: DashboardRecentPurchase[];
  recentGRNs: DashboardRecentGRN[];
  recentTransfers: DashboardRecentTransfer[];
  stockByCategory: { category: string; boxes: number }[];
}

export interface DashboardRecentGRN {
  id: string;
  grn_number: string;
  receipt_date: string;
  status: string;
  created_at: string;
  vendor_name: string;
  warehouse_name: string;
}

export interface DashboardRecentTransfer {
  id: string;
  transfer_number: string;
  transfer_date: string;
  status: string;
  created_at: string;
  from_warehouse_name: string;
  to_warehouse_name: string;
}

export interface DashboardLowStockItem {
  id: string;
  warehouse_id: string;
  product_id: string;
  shade_id?: string | null;
  current_stock_boxes: number;
  reorder_level_boxes: number;
  status: string;
  alerted_at: string;
  product_code: string;
  product_name: string;
  product_reorder?: number;
}

export interface DashboardRecentSale {
  id: string;
  so_number: string;
  order_date: string;
  status: string;
  grand_total: number;
  customer_name: string;
}

export interface DashboardRecentPurchase {
  id: string;
  po_number: string;
  order_date: string;
  status: string;
  grand_total: number;
  vendor_name: string;
}

export interface DashboardReport {
  totalRevenue: number;
  revenueChangePercent: number;
  totalOrders: number;
  ordersChangePercent: number;
  activeCustomers: number;
  lowStockCount: number;
  pendingGRNs: number;
  pendingInvoices: number;
  recentSalesOrders: Array<{
    id: string;
    so_number: string;
    customer_name: string;
    grand_total: number;
    status: string;
    order_date: string;
  }>;
  recentActivities: Array<{
    id: string;
    action: string;
    table_name: string;
    created_at: string;
    user_name?: string;
  }>;
}

export interface GSTReportRow {
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_gstin?: string;
  place_of_supply?: string;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  grand_total: number;
}

export interface RevenueReportRow {
  period: string;              // e.g. '2025-01', 'Jan 2025'
  revenue: number;
  orders: number;
  avg_order_value: number;
}

export interface AgingReportRow {
  customer_id: string;
  customer_name: string;
  current: number;             // 0–30 days
  days_30_60: number;
  days_60_90: number;
  over_90: number;
  total_outstanding: number;
}

export interface StockValuationRow {
  product_id: string;
  product_code: string;
  product_name: string;
  warehouse_name: string;
  total_boxes: number;
  avg_cost: number;
  total_value: number;
}

// ─── Stock Types ──────────────────────────────────────────────────────────────

export interface StockSummary {
  id: string;
  tenant_id: string;
  product_id: string;
  product_name: string;
  code: string;
  size_label: string;
  reorder_level_boxes: number;
  warehouse_id: string;
  warehouse_name: string;
  rack_id?: string | null;
  rack_name?: string | null;
  shade_id?: string | null;
  batch_id?: string | null;
  total_boxes: number;
  total_pieces: number;
  total_sqft: number;
  updated_at: string;
}

export type StockTransactionType =
  | 'GRN'
  | 'SALES_DISPATCH'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'RETURN_IN'
  | 'DAMAGE';

export interface StockLedgerEntry {
  id: string;
  tenant_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  warehouse_id: string;
  warehouse_name: string;
  shade_id?: string | null;
  batch_id?: string | null;
  transaction_type: StockTransactionType;
  reference_id?: string | null;
  reference_number?: string | null;
  qty_boxes_in: number;
  qty_boxes_out: number;
  balance_boxes: number;
  transaction_date: string;
  notes?: string | null;
  created_at: string;
}

export interface StockLedgerParams {
  productId?: string;
  warehouseId?: string;
  type?: StockTransactionType;
  from?: string;              // ISO date
  to?: string;                // ISO date
  page?: number;
  limit?: number;
}

export interface StockSummaryParams {
  warehouseId?: string;
  productId?: string;
  lowStock?: boolean;
}

// ─── Stock Transfer ───────────────────────────────────────────────────────────

export type StockTransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled';

export interface StockTransferItem {
  id?: string;
  transfer_id?: string;
  product_id: string;
  product_code?: string;
  product_name?: string;
  shade_id?: string | null;
  batch_id?: string | null;
  from_rack_id?: string | null;
  to_rack_id?: string | null;
  transferred_boxes: number;
  transferred_pieces?: number;
  received_boxes?: number;
  discrepancy_boxes?: number;
}

export interface StockTransfer {
  id: string;
  tenant_id: string;
  transfer_number: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: StockTransferStatus;
  transfer_date: string;
  received_date: string | null;
  vehicle_number: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  items?: StockTransferItem[];
  items_count?: number;
}

export interface CreateStockTransferDto {
  transfer_number: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status?: StockTransferStatus;
  transfer_date: string;
  received_date?: string | null;
  vehicle_number?: string | null;
  notes?: string | null;
  items?: Array<{
    product_id: string;
    shade_id?: string | null;
    batch_id?: string | null;
    from_rack_id?: string | null;
    to_rack_id?: string | null;
    transferred_boxes: number;
    transferred_pieces?: number;
  }>;
}

export type UpdateStockTransferDto = Partial<CreateStockTransferDto>;
