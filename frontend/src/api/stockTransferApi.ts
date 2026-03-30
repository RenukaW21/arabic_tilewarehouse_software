import axiosInstance from './axios';
import type { ApiResponse, ApiPaginatedResponse, PaginationParams } from '../types/api.types';
import type { StockTransfer, ProductTransferRow, CreateStockTransferDto, UpdateStockTransferDto } from '../types/stock.types';

export const stockTransferApi = {
  

  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<StockTransfer>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<StockTransfer>>('/stock-transfers', { params });
    return res.data;
  },
  getById: async (id: string): Promise<StockTransfer> => {
    const res = await axiosInstance.get<ApiResponse<StockTransfer>>(`/stock-transfers/${id}`);
    if (!res.data.success || !res.data.data) throw new Error(res.data.message ?? 'Transfer not found');
    return res.data.data;
  },
  create: async (data: CreateStockTransferDto): Promise<StockTransfer> => {
    const res = await axiosInstance.post<ApiResponse<StockTransfer>>('/stock-transfers', data);
    if (!res.data.success || !res.data.data) throw new Error(res.data.message ?? 'Create failed');
    return res.data.data;
  },
  update: async (id: string, data: UpdateStockTransferDto): Promise<StockTransfer> => {
    const res = await axiosInstance.put<ApiResponse<StockTransfer>>(`/stock-transfers/${id}`, data);
    if (!res.data.success || !res.data.data) throw new Error(res.data.message ?? 'Update failed');
    return res.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/stock-transfers/${id}`);
  },
  confirm: async (id: string): Promise<StockTransfer> => {
    const res = await axiosInstance.post<ApiResponse<StockTransfer>>(`/stock-transfers/${id}/confirm`);
    if (!res.data.success || !res.data.data) throw new Error(res.data.message ?? 'Confirm failed');
    return res.data.data;
  },
  getByProduct: async (productId: string): Promise<ProductTransferRow[]> => {
    const res = await axiosInstance.get<{ success: boolean; data: ProductTransferRow[] }>(
      `/stock-transfers/by-product/${productId}`
    );
    return res.data.data ?? [];
  },

  receive: async (id: string, notes?: string): Promise<StockTransfer> => {
    const res = await axiosInstance.post<ApiResponse<StockTransfer>>(
      `/stock-transfers/${id}/receive`,
      notes ? { notes } : {}
    );
    if (!res.data.success || !res.data.data) throw new Error(res.data.message ?? 'Receive failed');
    return res.data.data;
  },
};
