import axiosInstance from './axios';
import { ApiResponse, ApiPaginatedResponse, PaginationParams } from '../types/api.types';
import { GRN, CreateGRNDto, UpdateQualityDto } from '../types/grn.types';

/**
 * GRN (Goods Receipt Note) API Service
 * Base: /grn
 *
 * Routes:
 *   GET    /grn                               — list
 *   GET    /grn/:id                           — single with items
 *   POST   /grn                               — create draft GRN
 *   POST   /grn/:id/post                      — post GRN → updates stock
 *   PUT    /grn/:id/items/:itemId/quality      — update quality check result
 *
 * Role required for write: warehouse_manager+
 */
export const grnApi = {
  getAll: async (params?: PaginationParams & { vendorId?: string; warehouseId?: string; status?: string }): Promise<ApiPaginatedResponse<GRN>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<GRN>>('/grn', { params });
    return res.data;
  },

  getById: async (id: string): Promise<ApiResponse<GRN>> => {
    const res = await axiosInstance.get<ApiResponse<GRN>>(`/grn/${id}`);
    return res.data;
  },

  create: async (data: CreateGRNDto): Promise<ApiResponse<GRN>> => {
    const res = await axiosInstance.post<ApiResponse<GRN>>('/grn', data);
    return res.data;
  },

  /**
   * Post a verified GRN — this commits stock into the warehouse.
   * Cannot be undone once posted.
   */
  postGRN: async (id: string): Promise<ApiResponse<GRN>> => {
    const res = await axiosInstance.post<ApiResponse<GRN>>(`/grn/${id}/post`);
    return res.data;
  },

  /**
   * Update quality check result for a specific line item.
   */
  updateQuality: async (grnId: string, itemId: string, data: UpdateQualityDto): Promise<ApiResponse<GRN>> => {
    const res = await axiosInstance.put<ApiResponse<GRN>>(`/grn/${grnId}/items/${itemId}/quality`, data);
    return res.data;
  },
};
