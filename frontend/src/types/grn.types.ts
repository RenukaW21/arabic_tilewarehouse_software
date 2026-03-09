// ─── GRN (Goods Receipt Note) Types ──────────────────────────────────────────

export type GRNStatus = 'draft' | 'verified' | 'posted';
export type QualityStatus = 'pending' | 'accepted' | 'rejected' | 'partial';

export interface GRNItem {
  id?: string;
  product_id: string;
  product_name?: string;         // joined
  product_code?: string;         // joined
  shade_id?: string | null;
  batch_id?: string | null;
  ordered_qty_boxes: number;
  received_qty_boxes: number;
  accepted_qty_boxes?: number;   // set after quality check
  rejected_qty_boxes?: number;
  unit_cost: number;
  gst_rate: number;
  taxable_amount?: number;
  gst_amount?: number;
  total_amount?: number;
  quality_status?: QualityStatus;
  quality_notes?: string | null;
}

export interface GRN {
  id: string;
  tenant_id: string;
  grn_number: string;
  purchase_order_id?: string | null;
  po_number?: string | null;     // joined
  vendor_id: string;
  vendor_name?: string;          // joined
  warehouse_id: string;
  warehouse_name?: string;       // joined
  status: GRNStatus;
  /** API may return receipt_date (DB column) or received_date */
  received_date?: string;
  receipt_date?: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  notes?: string | null;
  subtotal: number;
  taxable_amount: number;
  gst_amount: number;
  grand_total: number;
  posted_at?: string | null;
  posted_by?: string | null;
  created_at: string;
  updated_at: string;
  items?: GRNItem[];
}

export interface CreateGRNDto {
  purchase_order_id?: string;
  vendor_id: string;
  warehouse_id: string;
  received_date: string;         // ISO date
  invoice_number?: string;
  invoice_date?: string;
  notes?: string;
  items: Array<{
    product_id: string;
    shade_id?: string;
    batch_id?: string;
    ordered_qty_boxes: number;
    received_qty_boxes: number;
    unit_cost: number;
    gst_rate: number;
  }>;
}

export interface UpdateQualityDto {
  /** Backend expects camelCase */
  qualityStatus?: string;
  qualityNotes?: string | null;
  accepted_qty_boxes?: number;
  rejected_qty_boxes?: number;
  quality_status?: QualityStatus;
  quality_notes?: string;
}
