// ─── Miscellaneous Module Types ───────────────────────────────────────────────

// Purchase Order
export type POStatus = 'draft' | 'confirmed' | 'partial' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  shade_id?: string | null;
  ordered_boxes: number;
  ordered_pieces: number;
  received_boxes: number;
  unit_price: number;
  discount_pct: number;
  tax_pct: number;
  line_total: number;
}

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  po_number: string;
  vendor_id: string;
  vendor_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  status: POStatus;
  order_date: string;
  expected_date?: string | null;
  notes?: string | null;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  created_at?: string;
  updated_at?: string;
  items?: PurchaseOrderItem[];
}

export interface CreatePOItemDto {
  product_id: string;
  shade_id?: string | null;
  ordered_boxes: number;
  ordered_pieces?: number;
  unit_price: number;
  discount_pct?: number;
  tax_pct?: number;
}

export interface CreatePODto {
  vendor_id: string;
  warehouse_id: string;
  order_date: string;
  expected_date?: string | null;
  notes?: string | null;
  items: CreatePOItemDto[];
}

// Purchase Return
export type PurchaseReturnStatus = 'draft' | 'dispatched' | 'acknowledged' | 'cancelled';

export interface PurchaseReturnItem {
  id: string;
  purchase_return_id: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  shade_id?: string | null;
  batch_id?: string | null;
  returned_boxes: number;
  returned_pieces: number;
  unit_price: number;
  return_reason?: string | null;
  line_total: number;
}

export interface PurchaseReturn {
  id: string;
  tenant_id: string;
  return_number: string;
  purchase_order_id?: string | null;
  grn_id?: string | null;
  vendor_id: string;
  vendor_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  return_date: string;
  reason: string;
  status: PurchaseReturnStatus;
  total_boxes: number;
  notes?: string | null;
  vehicle_number?: string | null;
  created_by?: string;
  created_at?: string;
  items?: PurchaseReturnItem[];
}

export interface CreatePurchaseReturnItemDto {
  grn_item_id?: string | null;
  product_id: string;
  shade_id?: string | null;
  batch_id?: string | null;
  returned_boxes: number;
  returned_pieces?: number;
  unit_price: number;
  return_reason?: string | null;
}

export interface CreatePurchaseReturnDto {
  purchase_order_id?: string | null;
  grn_id?: string | null;
  vendor_id: string;
  warehouse_id: string;
  return_date: string;
  reason: string;
  notes?: string | null;
  vehicle_number?: string | null;
  items: CreatePurchaseReturnItemDto[];
}

// Pick List
export type PickListStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface PickList {
  id: string;
  tenant_id: string;
  pick_list_number: string;
  sales_order_id: string;
  so_number?: string;
  warehouse_id: string;
  status: PickListStatus;
  assigned_to?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// Delivery Challan
export interface DeliveryChallan {
  id: string;
  tenant_id: string;
  challan_number: string;
  sales_order_id?: string | null;
  customer_id: string;
  customer_name?: string;
  warehouse_id: string;
  dispatch_date: string;
  vehicle_number?: string | null;
  driver_name?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// Customer Payment
export interface CustomerPayment {
  id: string;
  tenant_id: string;
  payment_number: string;
  customer_id: string;
  customer_name?: string;
  invoice_id?: string | null;
  invoice_number?: string | null;
  payment_date: string;
  amount: number;
  payment_mode: string;    // 'cash' | 'bank_transfer' | 'cheque' | 'upi'
  reference?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// Vendor Payment
export interface VendorPayment {
  id: string;
  tenant_id: string;
  payment_number: string;
  vendor_id: string;
  vendor_name?: string;
  grn_id?: string | null;
  grn_number?: string | null;
  payment_date: string;
  amount: number;
  payment_mode: string;
  reference?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// Credit Note
export interface CreditNote {
  id: string;
  tenant_id: string;
  cn_number: string;
  customer_id: string;
  customer_name?: string;
  invoice_id?: string | null;
  cn_date: string;
  reason?: string | null;
  amount: number;
  created_at: string;
  updated_at: string;
}

// Debit Note
export interface DebitNote {
  id: string;
  tenant_id: string;
  dn_number: string;
  vendor_id: string;
  vendor_name?: string;
  grn_id?: string | null;
  dn_date: string;
  reason?: string | null;
  amount: number;
  created_at: string;
  updated_at: string;
}

// Notification
export interface Notification {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  reference_id?: string | null;
  created_at: string;
}

// Audit Log
export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  user_name?: string;
  action: string;
  table_name: string;
  record_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

// Low Stock Alert
export interface LowStockAlert {
  id: string;
  tenant_id: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  warehouse_id: string;
  warehouse_name?: string;
  current_stock_boxes: number;
  reorder_level_boxes: number;
  status: 'open' | 'acknowledged' | 'resolved';
  alerted_at: string;
}
