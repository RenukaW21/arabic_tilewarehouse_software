import axiosInstance from './axios';
import type { ApiResponse, ApiPaginatedResponse, PaginationParams } from '@/types/api.types';

export interface StockSummaryRow {
  id: string;
  tenant_id: string;
  warehouse_id: string;
  rack_id: string | null;
  product_id: string;
  shade_id: string | null;
  batch_id: string | null;
  total_boxes: number;
  total_pieces: number;
  total_sqft: number;
  avg_cost_per_box: number | null;
  updated_at: string;
  code: string;
  product_name: string;
  warehouse_name: string;
  sqft_per_box?: number;
}

export interface OpeningStockPayload {
  warehouse_id: string;
  product_id: string;
  rack_id?: string | null;
  shade_id?: string | null;
  batch_id?: string | null;
  boxes: number;
  pieces?: number;
  sqft_per_box?: number;
  unit_price?: number | null;
  notes?: string | null;
}

export interface AdjustStockPayload {
  boxes_in?: number;
  boxes_out?: number;
  pieces_in?: number;
  pieces_out?: number;
  notes?: string | null;
}

export interface InventoryListParams extends PaginationParams {
  sortBy?: 'code' | 'product_name' | 'warehouse_name' | 'total_boxes' | 'total_pieces' | 'total_sqft' | 'updated_at';
  sortOrder?: 'ASC' | 'DESC';
}

export const inventoryApi = {
  getStockList: async (params?: InventoryListParams): Promise<ApiPaginatedResponse<StockSummaryRow>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<StockSummaryRow>>('/inventory/stock', { params });
    return res.data;
  },

  getStockById: async (id: string): Promise<ApiResponse<StockSummaryRow>> => {
    const res = await axiosInstance.get<ApiResponse<StockSummaryRow>>(`/inventory/stock/${id}`);
    return res.data;
  },

  createOpeningStock: async (payload: OpeningStockPayload): Promise<ApiResponse<StockSummaryRow | null>> => {
    const res = await axiosInstance.post<ApiResponse<StockSummaryRow | null>>('/inventory/opening-stock', payload);
    return res.data;
  },

  adjustStock: async (id: string, payload: AdjustStockPayload): Promise<ApiResponse<StockSummaryRow>> => {
    const res = await axiosInstance.put<ApiResponse<StockSummaryRow>>(`/inventory/adjust/${id}`, payload);
    return res.data;
  },

  deleteStock: async (id: string): Promise<ApiResponse<null>> => {
    const res = await axiosInstance.delete<ApiResponse<null>>(`/inventory/stock/${id}`);
    return res.data;
  },
};
