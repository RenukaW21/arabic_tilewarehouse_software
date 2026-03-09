/**
 * Payments API — customer_payments and vendor_payments via Express backend.
 * Uses /api/v1 with tenant isolation (auth).
 */
import axiosInstance from './axios';
import type { ApiResponse, ApiPaginatedResponse, PaginationParams } from '@/types/api.types';

export interface CustomerPayment {
  id: string;
  tenant_id: string;
  payment_number: string;
  customer_id: string;
  invoice_id?: string | null;
  payment_date?: string | null;
  amount: number;
  payment_mode: string;
  reference_number?: string | null;
  bank_name?: string | null;
  status?: string;
  created_by?: string | null;
  created_at: string;
}

export interface VendorPayment {
  id: string;
  tenant_id: string;
  payment_number: string;
  vendor_id: string;
  purchase_order_id?: string | null;
  payment_date?: string | null;
  amount: number;
  payment_mode: string;
  reference_number?: string | null;
  bank_name?: string | null;
  status?: string;
  created_by?: string | null;
  created_at: string;
}

export const customerPaymentsApi = {
  getAll: (params?: PaginationParams) =>
    axiosInstance.get<ApiPaginatedResponse<CustomerPayment>>('/customer-payments', { params }).then((r) => r.data),
  getById: (id: string) =>
    axiosInstance.get<ApiResponse<CustomerPayment>>(`/customer-payments/${id}`).then((r) => r.data),
  create: (data: Partial<CustomerPayment>) =>
    axiosInstance.post<ApiResponse<CustomerPayment>>('/customer-payments', data).then((r) => r.data),
  update: (id: string, data: Partial<CustomerPayment>) =>
    axiosInstance.put<ApiResponse<CustomerPayment>>(`/customer-payments/${id}`, data).then((r) => r.data),
  remove: (id: string) => axiosInstance.delete(`/customer-payments/${id}`),
};

export const vendorPaymentsApi = {
  getAll: (params?: PaginationParams) =>
    axiosInstance.get<ApiPaginatedResponse<VendorPayment>>('/vendor-payments', { params }).then((r) => r.data),
  getById: (id: string) =>
    axiosInstance.get<ApiResponse<VendorPayment>>(`/vendor-payments/${id}`).then((r) => r.data),
  create: (data: Partial<VendorPayment>) =>
    axiosInstance.post<ApiResponse<VendorPayment>>('/vendor-payments', data).then((r) => r.data),
  update: (id: string, data: Partial<VendorPayment>) =>
    axiosInstance.put<ApiResponse<VendorPayment>>(`/vendor-payments/${id}`, data).then((r) => r.data),
  remove: (id: string) => axiosInstance.delete(`/vendor-payments/${id}`),
};
