import axiosInstance from './axios';
import { ApiResponse, ApiPaginatedResponse, PaginationParams } from '@/types/api.types';

export interface CreditNote {
    id: string;
    tenant_id: string;
    cn_number: string;
    customer_id: string;
    sales_return_id?: string | null;
    invoice_id?: string | null;
    cn_date: string;
    amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    status: 'draft' | 'issued' | 'adjusted' | 'cancelled';
    adjusted_against_payment_id?: string | null;
    notes?: string | null;
    created_by: string;
    created_at: string;
}

export interface DebitNote {
    id: string;
    tenant_id: string;
    dn_number: string;
    vendor_id: string;
    purchase_return_id?: string | null;
    purchase_order_id?: string | null;
    dn_date: string;
    amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    status: 'draft' | 'issued' | 'acknowledged' | 'settled';
    notes?: string | null;
    created_by: string;
    created_at: string;
}

export const creditNotesApi = {
    getAll: (params?: PaginationParams) =>
        axiosInstance.get<ApiPaginatedResponse<CreditNote>>('/credit-notes', { params }).then((r) => r.data),
    getById: (id: string) => axiosInstance.get<ApiResponse<CreditNote>>(`/credit-notes/${id}`).then((r) => r.data),
    create: (data: Partial<CreditNote>) => axiosInstance.post<ApiResponse<CreditNote>>('/credit-notes', data).then((r) => r.data),
    update: (id: string, data: Partial<CreditNote>) =>
        axiosInstance.put<ApiResponse<CreditNote>>(`/credit-notes/${id}`, data).then((r) => r.data),
    remove: (id: string) => axiosInstance.delete(`/credit-notes/${id}`),
};

export const debitNotesApi = {
    getAll: (params?: PaginationParams) =>
        axiosInstance.get<ApiPaginatedResponse<DebitNote>>('/debit-notes', { params }).then((r) => r.data),
    getById: (id: string) => axiosInstance.get<ApiResponse<DebitNote>>(`/debit-notes/${id}`).then((r) => r.data),
    create: (data: Partial<DebitNote>) => axiosInstance.post<ApiResponse<DebitNote>>('/debit-notes', data).then((r) => r.data),
    update: (id: string, data: Partial<DebitNote>) =>
        axiosInstance.put<ApiResponse<DebitNote>>(`/debit-notes/${id}`, data).then((r) => r.data),
    remove: (id: string) => axiosInstance.delete(`/debit-notes/${id}`),
};
