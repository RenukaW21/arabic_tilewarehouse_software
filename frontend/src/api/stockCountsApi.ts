import axiosInstance from './axios';
import type { ApiResponse, ApiPaginatedResponse, PaginationParams } from '@/types/api.types';

export interface StockCountItem {
  id: string;
  stock_count_id: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  shade_id?: string | null;
  batch_id?: string | null;
  rack_id?: string | null;
  system_boxes: number;
  counted_boxes: number | null;
  variance_boxes: number;
  status?: string;
}

export interface StockCount {
  id: string;
  tenant_id: string;
  count_number: string;
  warehouse_id: string;
  warehouse_name?: string;
  count_type: 'full' | 'cycle' | 'spot';
  status: string;
  count_date: string;
  created_by?: string;
  created_at?: string;
  items?: StockCountItem[];
}

export interface CreateStockCountPayload {
  warehouse_id: string;
  count_type?: 'full' | 'cycle' | 'spot';
  count_date?: string;
}

export interface StockCountListParams extends PaginationParams {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const stockCountsApi = {
  getAll: (params?: StockCountListParams) =>
    axiosInstance.get<ApiPaginatedResponse<StockCount>>('/stock-counts', { params }).then(r => r.data),
  getById: (id: string) =>
    axiosInstance.get<ApiResponse<StockCount>>(`/stock-counts/${id}`).then(r => r.data),
  create: (payload: CreateStockCountPayload) =>
    axiosInstance.post<ApiResponse<StockCount>>('/stock-counts', payload).then(r => r.data),
  loadFromStock: (id: string) =>
    axiosInstance.post<ApiResponse<StockCount>>(`/stock-counts/${id}/load-from-stock`).then(r => r.data),
  updateItem: (countId: string, itemId: string, counted_boxes: number) =>
    axiosInstance.put<ApiResponse<StockCount>>(`/stock-counts/${countId}/items/${itemId}`, { counted_boxes }).then(r => r.data),
};
