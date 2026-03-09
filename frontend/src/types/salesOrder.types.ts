// ─── Sales Order Types ────────────────────────────────────────────────────────

export type SOStatus = 'draft' | 'confirmed' | 'pick_ready' | 'dispatched' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid';

export interface SalesOrderItem {
  id?: string;
  product_id: string;
  product_name?: string;   // joined from backend
  product_code?: string;   // joined from backend
  shade_id?: string | null;
  batch_id?: string | null;
  quantity_boxes: number;
  quantity_pieces?: number | null;
  unit_price: number;      // price per box
  discount_pct?: number;   // 0–100
  gst_rate: number;
  taxable_amount?: number; // computed
  gst_amount?: number;     // computed
  total_amount?: number;   // computed
}

export interface SalesOrder {
  id: string;
  tenant_id: string;
  so_number: string;
  customer_id: string;
  customer_name?: string;   // joined
  warehouse_id: string;
  warehouse_name?: string;  // joined
  status: SOStatus;
  payment_status: PaymentStatus;
  order_date: string;
  delivery_date?: string | null;
  shipping_address?: string | null;
  notes?: string | null;
  subtotal: number;
  discount_amount?: number;
  taxable_amount: number;
  gst_amount: number;
  grand_total: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  items?: SalesOrderItem[];
}

export interface CreateSalesOrderDto {
  customer_id: string;
  warehouse_id: string;
  order_date: string;        // ISO date string e.g. '2025-01-15'
  delivery_date?: string;
  shipping_address?: string;
  notes?: string;
  items: Array<{
    product_id: string;
    shade_id?: string;
    batch_id?: string;
    quantity_boxes: number;
    quantity_pieces?: number;
    unit_price: number;
    discount_pct?: number;
    gst_rate: number;
  }>;
}
