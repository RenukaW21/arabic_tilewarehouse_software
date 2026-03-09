/**
 * Sales module API: orders, pick-lists, delivery-challans, invoices, sales-returns.
 * Uses Express backend; all paths are relative to /api/v1.
 */
import axiosInstance from './axios';
import type { ApiResponse, ApiPaginatedResponse, PaginationParams } from '@/types/api.types';

// ─── Sales Orders ───────────────────────────────────────────────────────────
export interface SalesOrderItem {
  id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  shade_id?: string | null;
  ordered_boxes: number;
  ordered_pieces?: number;
  unit_price: number;
  discount_pct?: number;
  tax_pct?: number;
  line_total?: number;
}

export interface SalesOrder {
  id: string;
  so_number: string;
  customer_id: string;
  customer_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  status: string;
  order_date: string;
  expected_delivery_date?: string | null;
  sub_total?: number;
  discount_amount?: number;
  tax_amount?: number;
  grand_total?: number;
  payment_status: string;
  items?: SalesOrderItem[];
}

export interface CreateSalesOrderDto {
  customerId: string;
  warehouseId: string;
  orderDate?: string;
  expectedDeliveryDate?: string | null;
  deliveryAddress?: string | null;
  discountAmount?: number;
  paymentStatus?: 'pending' | 'partial' | 'paid';
  notes?: string | null;
  items: Array<{
    productId: string;
    shadeId?: string | null;
    batchId?: string | null;
    orderedBoxes: number;
    orderedPieces?: number;
    unitPrice: number;
    discountPct?: number;
    taxPct?: number;
  }>;
}

export const salesOrdersApi = {
  getAll: (params?: PaginationParams & { status?: string; payment_status?: string }) =>
    axiosInstance.get<ApiPaginatedResponse<SalesOrder>>('/sales-orders', { params }).then((r) => r.data),
  getById: (id: string) =>
    axiosInstance.get<ApiResponse<SalesOrder>>(`/sales-orders/${id}`).then((r) => r.data),
  create: (data: CreateSalesOrderDto) =>
    axiosInstance.post<ApiResponse<SalesOrder>>('/sales-orders', data).then((r) => r.data),
  update: (id: string, data: CreateSalesOrderDto) =>
    axiosInstance.put<ApiResponse<SalesOrder>>(`/sales-orders/${id}`, data).then((r) => r.data),
  remove: (id: string) => axiosInstance.delete(`/sales-orders/${id}`),
  confirm: (id: string) =>
    axiosInstance.post<ApiResponse<SalesOrder>>(`/sales-orders/${id}/confirm`).then((r) => r.data),
};

// ─── Pick Lists ──────────────────────────────────────────────────────────────
export interface PickListItem {
  id: string;
  product_id: string;
  product_code?: string;
  product_name?: string;
  requested_boxes: number;
  picked_boxes: number;
  status: string;
}

export interface PickList {
  id: string;
  pick_number: string;
  sales_order_id: string;
  so_number?: string;
  warehouse_id: string;
  warehouse_name?: string;
  status: string;
  assigned_to?: string | null;
  items?: PickListItem[];
}

export const pickListsApi = {
  getAll: (params?: PaginationParams & { status?: string; sales_order_id?: string }) =>
    axiosInstance.get<ApiPaginatedResponse<PickList>>('/pick-lists', { params }).then((r) => r.data),
  getById: (id: string) =>
    axiosInstance.get<ApiResponse<PickList>>(`/pick-lists/${id}`).then((r) => r.data),
  update: (id: string, data: { assigned_to?: string | null }) =>
    axiosInstance.put<ApiResponse<PickList>>(`/pick-lists/${id}`, data).then((r) => r.data),
  remove: (id: string) => axiosInstance.delete(`/pick-lists/${id}`),
  assign: (id: string, assigned_to: string | null) =>
    axiosInstance.patch<ApiResponse<PickList>>(`/pick-lists/${id}/assign`, { assigned_to }).then((r) => r.data),
  updateItemPicked: (id: string, itemId: string, picked_boxes: number) =>
    axiosInstance.put<ApiResponse<PickList>>(`/pick-lists/${id}/items/${itemId}`, { picked_boxes }).then((r) => r.data),
  complete: (id: string) =>
    axiosInstance.post<ApiResponse<PickList>>(`/pick-lists/${id}/complete`).then((r) => r.data),
  reopen: (id: string) =>
    axiosInstance.post<ApiResponse<PickList>>(`/pick-lists/${id}/reopen`).then((r) => r.data),
};

// ─── Delivery Challans ───────────────────────────────────────────────────────
export interface DeliveryChallanItem {
  id: string;
  product_id: string;
  product_code?: string;
  product_name?: string;
  dispatched_boxes: number;
  unit_price: number;
}

export interface DeliveryChallan {
  id: string;
  dc_number: string;
  sales_order_id: string;
  so_number?: string;
  pick_list_id?: string | null;
  customer_id: string;
  customer_name?: string;
  warehouse_id?: string;
  dispatch_date: string;
  status: string;
  vehicle_number?: string | null;
  transporter_name?: string | null;
  lr_number?: string | null;
  items?: DeliveryChallanItem[];
}

export const deliveryChallansApi = {
  getAll: (params?: PaginationParams & { status?: string; sales_order_id?: string }) =>
    axiosInstance.get<ApiPaginatedResponse<DeliveryChallan>>('/delivery-challans', { params }).then((r) => r.data),
  getById: (id: string) =>
    axiosInstance.get<ApiResponse<DeliveryChallan>>(`/delivery-challans/${id}`).then((r) => r.data),
  createFromPickList: (data: { pick_list_id: string; dispatch_date?: string; vehicle_number?: string; transporter_name?: string; lr_number?: string }) =>
    axiosInstance.post<ApiResponse<DeliveryChallan>>('/delivery-challans', data).then((r) => r.data),
  update: (id: string, data: { dispatch_date?: string; vehicle_number?: string; transporter_name?: string; lr_number?: string }) =>
    axiosInstance.put<ApiResponse<DeliveryChallan>>(`/delivery-challans/${id}`, data).then((r) => r.data),
  remove: (id: string) => axiosInstance.delete(`/delivery-challans/${id}`),
  dispatch: (id: string) =>
    axiosInstance.post<ApiResponse<DeliveryChallan>>(`/delivery-challans/${id}/dispatch`).then((r) => r.data),
};

// ─── Invoices (re-export / thin wrapper) ─────────────────────────────────────
export { invoiceApi } from './invoiceApi';

// ─── Sales Returns ───────────────────────────────────────────────────────────
export interface SalesReturnItem {
  id?: string;
  product_id: string;
  product_code?: string;
  product_name?: string;
  returned_boxes: number;
  unit_price: number;
  line_total?: number;
}

export interface SalesReturn {
  id: string;
  return_number: string;
  sales_order_id?: string | null;
  customer_id: string;
  customer_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  return_date: string;
  return_reason: string;
  status: string;
  total_boxes?: number;
  credit_note_id?: string | null;
  items?: SalesReturnItem[];
}

export interface CreateSalesReturnDto {
  customer_id: string;
  warehouse_id: string;
  sales_order_id?: string | null;
  invoice_id?: string | null;
  return_date?: string;
  return_reason: string;
  notes?: string | null;
  items: Array<{ product_id: string; shade_id?: string | null; batch_id?: string | null; returned_boxes: number; unit_price: number }>;
}

export interface UpdateSalesReturnDto {
  customer_id?: string;
  warehouse_id?: string;
  return_date?: string;
  return_reason?: string;
  notes?: string | null;
  items?: Array<{ product_id: string; shade_id?: string | null; batch_id?: string | null; returned_boxes: number; unit_price: number }>;
}

export const salesReturnsApi = {
  getAll: (params?: PaginationParams & { status?: string; customer_id?: string }) =>
    axiosInstance.get<ApiPaginatedResponse<SalesReturn>>('/sales-returns', { params }).then((r) => r.data),
  getById: (id: string) =>
    axiosInstance.get<ApiResponse<SalesReturn>>(`/sales-returns/${id}`).then((r) => r.data),
  create: (data: CreateSalesReturnDto) =>
    axiosInstance.post<ApiResponse<SalesReturn>>('/sales-returns', data).then((r) => r.data),
  update: (id: string, data: UpdateSalesReturnDto) =>
    axiosInstance.put<ApiResponse<SalesReturn>>(`/sales-returns/${id}`, data).then((r) => r.data),
  remove: (id: string) => axiosInstance.delete(`/sales-returns/${id}`),
  receive: (id: string) =>
    axiosInstance.post<ApiResponse<SalesReturn>>(`/sales-returns/${id}/receive`).then((r) => r.data),
};
