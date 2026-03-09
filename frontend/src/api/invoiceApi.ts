import axiosInstance from './axios';
import { ApiResponse, ApiPaginatedResponse, PaginationParams } from '../types/api.types';
import { Invoice, CreateInvoiceFromSODto } from '../types/invoice.types';

/**
 * Invoice API Service
 * Base: /invoices
 *
 * Routes:
 *   GET    /invoices            — list
 *   GET    /invoices/:id        — single with items
 *   POST   /invoices            — create invoice from sales order
 *   POST   /invoices/:id/issue  — issue the invoice (finalise)
 *
 * Role required: super_admin | admin | accountant
 */
export const invoiceApi = {
  getAll: async (
    params?: PaginationParams & { customerId?: string; status?: string; from?: string; to?: string }
  ): Promise<ApiPaginatedResponse<Invoice>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<Invoice>>('/invoices', { params });
    return res.data;
  },

  getById: async (id: string): Promise<ApiResponse<Invoice>> => {
    const res = await axiosInstance.get<ApiResponse<Invoice>>(`/invoices/${id}`);
    return res.data;
  },

  /**
   * Generate an invoice from an existing confirmed Sales Order.
   */
  createFromSO: async (data: CreateInvoiceFromSODto): Promise<ApiResponse<Invoice>> => {
    const res = await axiosInstance.post<ApiResponse<Invoice>>('/invoices', data);
    return res.data;
  },

  /**
   * Issue (finalise) a draft invoice — status changes to 'issued'.
   */
  issueInvoice: async (id: string): Promise<ApiResponse<Invoice>> => {
    const res = await axiosInstance.post<ApiResponse<Invoice>>(`/invoices/${id}/issue`);
    return res.data;
  },

  updatePaymentStatus: async (id: string, payment_status: 'pending' | 'partial' | 'paid'): Promise<ApiResponse<Invoice>> => {
    const res = await axiosInstance.patch<ApiResponse<Invoice>>(`/invoices/${id}/payment`, { payment_status });
    return res.data;
  },

  update: async (id: string, data: { due_date?: string; billing_address?: string; shipping_address?: string }): Promise<ApiResponse<Invoice>> => {
    const res = await axiosInstance.put<ApiResponse<Invoice>>(`/invoices/${id}`, data);
    return res.data;
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/invoices/${id}`);
  },
};
