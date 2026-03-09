// ─── Invoice Types ────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'issued' | 'cancelled';

export interface InvoiceItem {
  id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  hsn_code?: string | null;
  quantity_boxes: number;
  unit_price: number;
  discount_pct?: number;
  gst_rate?: number;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_amount?: number;
  line_total?: number;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  sales_order_id?: string | null;
  so_number?: string | null;
  customer_id: string;
  customer_name?: string;
  customer_gstin?: string | null;
  warehouse_id: string;
  status: InvoiceStatus;
  invoice_date: string;
  due_date?: string | null;
  place_of_supply?: string | null;
  is_igst?: boolean;
  /** From API/DB: sub_total (snake_case) or subtotal */
  subtotal?: number;
  sub_total?: number;
  discount_amount: number;
  taxable_amount?: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  grand_total: number;
  payment_status: string;
  billing_address?: string | null;
  shipping_address?: string | null;
  notes?: string | null;
  issued_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
}

export interface CreateInvoiceFromSODto {
  sales_order_id: string;
  invoice_date: string;         // ISO date
  due_date?: string;
  place_of_supply?: string;
  is_igst?: boolean;
}
