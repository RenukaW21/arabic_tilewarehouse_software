import axiosInstance from './axios';
import { ApiResponse, ApiPaginatedResponse, PaginationParams } from '../types/api.types';
import {
  PurchaseOrder,
  CreatePODto,
  PickList,
  DeliveryChallan,
  CustomerPayment,
  VendorPayment,
  CreditNote,
  DebitNote,
  Notification,
  AuditLog,
  LowStockAlert,
  PurchaseReturn,
  CreatePurchaseReturnDto,
} from '../types/misc.types';

export interface PurchaseOrderListParams extends PaginationParams {
  status?: string;
  vendor_id?: string;
  warehouse_id?: string;
}

// ─── Purchase Order API ───────────────────────────────────────────────────────
export const purchaseOrderApi = {
  getAll: async (params?: PurchaseOrderListParams): Promise<ApiPaginatedResponse<PurchaseOrder>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<PurchaseOrder>>('/purchase-orders', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<PurchaseOrder>> => {
    const res = await axiosInstance.get<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`);
    return res.data;
  },
  create: async (data: CreatePODto): Promise<ApiResponse<PurchaseOrder>> => {
    const res = await axiosInstance.post<ApiResponse<PurchaseOrder>>('/purchase-orders', data);
    return res.data;
  },
  update: async (id: string, data: Partial<CreatePODto>): Promise<ApiResponse<PurchaseOrder>> => {
    const res = await axiosInstance.put<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`, data);
    return res.data;
  },
  approve: async (id: string): Promise<ApiResponse<PurchaseOrder>> => {
    const res = await axiosInstance.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/approve`);
    return res.data;
  },
  delete: async (id: string): Promise<ApiResponse<PurchaseOrder>> => {
    const res = await axiosInstance.delete<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`);
    return res.data;
  },
};

// ─── Pick List API ────────────────────────────────────────────────────────────
export const pickListApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<PickList>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<PickList>>('/pick-lists', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<PickList>> => {
    const res = await axiosInstance.get<ApiResponse<PickList>>(`/pick-lists/${id}`);
    return res.data;
  },
};

// ─── Delivery Challan API ─────────────────────────────────────────────────────
export const deliveryChallanApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<DeliveryChallan>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<DeliveryChallan>>('/delivery-challans', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<DeliveryChallan>> => {
    const res = await axiosInstance.get<ApiResponse<DeliveryChallan>>(`/delivery-challans/${id}`);
    return res.data;
  },
  create: async (data: Partial<DeliveryChallan>): Promise<ApiResponse<DeliveryChallan>> => {
    const res = await axiosInstance.post<ApiResponse<DeliveryChallan>>('/delivery-challans', data);
    return res.data;
  },
};

// ─── Customer Payment API ─────────────────────────────────────────────────────
export const customerPaymentApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<CustomerPayment>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<CustomerPayment>>('/customer-payments', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<CustomerPayment>> => {
    const res = await axiosInstance.get<ApiResponse<CustomerPayment>>(`/customer-payments/${id}`);
    return res.data;
  },
  create: async (data: Partial<CustomerPayment>): Promise<ApiResponse<CustomerPayment>> => {
    const res = await axiosInstance.post<ApiResponse<CustomerPayment>>('/customer-payments', data);
    return res.data;
  },
};

// ─── Vendor Payment API ───────────────────────────────────────────────────────
export const vendorPaymentApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<VendorPayment>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<VendorPayment>>('/vendor-payments', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<VendorPayment>> => {
    const res = await axiosInstance.get<ApiResponse<VendorPayment>>(`/vendor-payments/${id}`);
    return res.data;
  },
  create: async (data: Partial<VendorPayment>): Promise<ApiResponse<VendorPayment>> => {
    const res = await axiosInstance.post<ApiResponse<VendorPayment>>('/vendor-payments', data);
    return res.data;
  },
};

// ─── Credit Note API ──────────────────────────────────────────────────────────
export const creditNoteApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<CreditNote>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<CreditNote>>('/credit-notes', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<CreditNote>> => {
    const res = await axiosInstance.get<ApiResponse<CreditNote>>(`/credit-notes/${id}`);
    return res.data;
  },
};

// ─── Debit Note API ───────────────────────────────────────────────────────────
export const debitNoteApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<DebitNote>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<DebitNote>>('/debit-notes', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<DebitNote>> => {
    const res = await axiosInstance.get<ApiResponse<DebitNote>>(`/debit-notes/${id}`);
    return res.data;
  },
};

// ─── Alerts API ───────────────────────────────────────────────────────────────
export const alertApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<LowStockAlert>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<LowStockAlert>>('/alerts', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<LowStockAlert>> => {
    const res = await axiosInstance.get<ApiResponse<LowStockAlert>>(`/alerts/${id}`);
    return res.data;
  },
};

// ─── Notifications API ────────────────────────────────────────────────────────
export const notificationApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<Notification>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<Notification>>('/notifications', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<Notification>> => {
    const res = await axiosInstance.get<ApiResponse<Notification>>(`/notifications/${id}`);
    return res.data;
  },
};

// ─── Audit Logs API ───────────────────────────────────────────────────────────
export const auditLogApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<AuditLog>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<AuditLog>>('/audit-logs', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<AuditLog>> => {
    const res = await axiosInstance.get<ApiResponse<AuditLog>>(`/audit-logs/${id}`);
    return res.data;
  },
};

// ─── Sales Returns API ────────────────────────────────────────────────────────
export const salesReturnApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<Record<string, unknown>>> => {
    const res = await axiosInstance.get('/sales-returns', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<Record<string, unknown>>> => {
    const res = await axiosInstance.get(`/sales-returns/${id}`);
    return res.data;
  },
};

// ─── Purchase Returns API ─────────────────────────────────────────────────────
export interface PurchaseReturnListParams extends PaginationParams {
  status?: string;
  vendor_id?: string;
  warehouse_id?: string;
}

export const purchaseReturnApi = {
  getAll: async (params?: PurchaseReturnListParams): Promise<ApiPaginatedResponse<PurchaseReturn>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<PurchaseReturn>>('/purchase-returns', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<PurchaseReturn>> => {
    const res = await axiosInstance.get<ApiResponse<PurchaseReturn>>(`/purchase-returns/${id}`);
    return res.data;
  },
  create: async (data: CreatePurchaseReturnDto): Promise<ApiResponse<PurchaseReturn>> => {
    const res = await axiosInstance.post<ApiResponse<PurchaseReturn>>('/purchase-returns', data);
    return res.data;
  },
  update: async (id: string, data: { return_date?: string; reason?: string; notes?: string | null; vehicle_number?: string | null }): Promise<ApiResponse<PurchaseReturn>> => {
    const res = await axiosInstance.put<ApiResponse<PurchaseReturn>>(`/purchase-returns/${id}`, data);
    return res.data;
  },
};
