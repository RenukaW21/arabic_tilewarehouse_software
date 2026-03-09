import axiosInstance from './axios';
import type { ApiResponse, ApiPaginatedResponse, PaginationParams } from '@/types/api.types';

export interface StockAdjustment {
  id: string;
  tenant_id: string;
  warehouse_id: string;
  product_id: string;
  shade_id?: string | null;
  batch_id?: string | null;
  rack_id?: string | null;
  adjustment_type: 'add' | 'deduct';
  boxes: number;
  pieces: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
  created_by?: string;
  created_at?: string;
  product_name?: string;
  product_code?: string;
  warehouse_name?: string;
}

export interface CreateStockAdjustmentPayload {
  warehouse_id: string;
  product_id: string;
  shade_id?: string | null;
  batch_id?: string | null;
  rack_id?: string | null;
  adjustment_type: 'add' | 'deduct';
  boxes: number;
  pieces?: number;
  reason: string;
}

export interface StockAdjustmentListParams extends PaginationParams {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  status?: string;
}

export const stockAdjustmentsApi = {
  getAll: (params?: StockAdjustmentListParams) =>
    axiosInstance.get<ApiPaginatedResponse<StockAdjustment>>('/stock-adjustments', { params }).then(r => r.data),
  getById: (id: string) =>
    axiosInstance.get<ApiResponse<StockAdjustment>>(`/stock-adjustments/${id}`).then(r => r.data),
  create: (payload: CreateStockAdjustmentPayload) =>
    axiosInstance.post<ApiResponse<StockAdjustment>>('/stock-adjustments', payload).then(r => r.data),
  update: (id: string, payload: Partial<CreateStockAdjustmentPayload>) =>
    axiosInstance.put<ApiResponse<StockAdjustment>>(`/stock-adjustments/${id}`, payload).then(r => r.data),
  approve: (id: string) =>
    axiosInstance.post<ApiResponse<StockAdjustment>>(`/stock-adjustments/${id}/approve`).then(r => r.data),
  delete: (id: string) =>
    axiosInstance.delete(`/stock-adjustments/${id}`),
};
