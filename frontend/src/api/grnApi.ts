import axiosInstance from './axios';
import { ApiResponse, ApiPaginatedResponse, PaginationParams } from '../types/api.types';
import { GRN, CreateGRNDto, UpdateQualityDto } from '../types/grn.types';

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

  update: async (id: string, data: Partial<{
    receipt_date: string; invoice_number?: string; invoice_date?: string;
    vehicle_number?: string; notes?: string; vendor_id?: string; warehouse_id?: string;
  }>): Promise<ApiResponse<GRN>> => {
    const res = await axiosInstance.put<ApiResponse<GRN>>(`/grn/${id}`, data);
    return res.data;
  },

  addItem: async (id: string, data: {
    product_id: string; shade_id?: string | null; batch_id?: string | null; batch_number?: string | null;
    rack_id?: string | null; received_boxes: number; received_pieces?: number;
    damaged_boxes?: number; unit_price: number; quality_status?: string;
    quality_notes?: string | null;
  }): Promise<ApiResponse<GRN>> => {
    const res = await axiosInstance.post<ApiResponse<GRN>>(`/grn/${id}/items`, data);
    return res.data;
  },

  // FEATURE 4 — Edit item fields (received_boxes, received_pieces, damaged_boxes, unit_price, shade_id)
  updateItem: async (grnId: string, itemId: string, data: {
    received_boxes?: number; received_pieces?: number; damaged_boxes?: number;
    unit_price?: number; shade_id?: string | null; rack_id?: string | null;
    batch_number?: string | null; batch_id?: string | null;
  }): Promise<ApiResponse<GRN>> => {
    const res = await axiosInstance.put<ApiResponse<GRN>>(`/grn/${grnId}/items/${itemId}`, data);
    return res.data;
  },

  // FEATURE 5 — Delete a single item (draft only)
  deleteItem: async (grnId: string, itemId: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    const res = await axiosInstance.delete<ApiResponse<{ deleted: boolean }>>(`/grn/${grnId}/items/${itemId}`);
    return res.data;
  },

  // FEATURE 2 — Assign rack to item
  assignRack: async (grnId: string, itemId: string, rackId: string | null): Promise<ApiResponse<GRN>> => {
    const res = await axiosInstance.put<ApiResponse<GRN>>(`/grn/${grnId}/items/${itemId}/rack`, { rack_id: rackId });
    return res.data;
  },

  // FEATURE 9 — Generate barcode labels for item
  generateLabels: async (grnId: string, itemId: string): Promise<ApiResponse<{ barcode_printed: boolean }>> => {
    const res = await axiosInstance.post<ApiResponse<{ barcode_printed: boolean }>>(`/grn/${grnId}/items/${itemId}/labels`);
    return res.data;
  },

  delete: async (id: string): Promise<ApiResponse<{ id: string; deleted: boolean }>> => {
    const res = await axiosInstance.delete<ApiResponse<{ id: string; deleted: boolean }>>(`/grn/${id}`);
    return res.data;
  },

  postGRN: async (id: string): Promise<ApiResponse<GRN>> => {
    const res = await axiosInstance.post<ApiResponse<GRN>>(`/grn/${id}/post`);
    return res.data;
  },

  updateQuality: async (grnId: string, itemId: string, data: UpdateQualityDto): Promise<ApiResponse<GRN>> => {
    const res = await axiosInstance.put<ApiResponse<GRN>>(`/grn/${grnId}/items/${itemId}/quality`, data);
    return res.data;
  },
};