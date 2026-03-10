import api from '@/lib/api';
import axiosInstance from './axios';
import type { ApiResponse, ApiPaginatedResponse, PaginationParams } from '../types/api.types';
import type {
  Warehouse, CreateWarehouseDto, UpdateWarehouseDto,
  Rack, CreateRackDto, UpdateRackDto,
  Category, CreateCategoryDto, UpdateCategoryDto,
  Shade, Batch,
} from '../types/warehouse.types';

// ─── Warehouse API (uses Express backend; api from @/lib/api) ──────────────────
export const warehouseApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<Warehouse>> => {
    const res = await api.get<ApiPaginatedResponse<Warehouse>>('/warehouses', { params });
    return res.data;
  },
  getById: async (id: string): Promise<Warehouse> => {
    const res = await api.get<ApiResponse<Warehouse>>(`/warehouses/${id}`);
    if (!res.data.success || !res.data.data) throw new Error(res.data.message ?? 'Warehouse not found');
    return res.data.data;
  },
  create: async (data: CreateWarehouseDto): Promise<Warehouse> => {
    const res = await api.post<ApiResponse<Warehouse>>('/warehouses', data);
    if (!res.data.success || !res.data.data) throw new Error(res.data.message ?? 'Create failed');
    return res.data.data;
  },
  update: async (id: string, data: UpdateWarehouseDto): Promise<Warehouse> => {
    const res = await api.put<ApiResponse<Warehouse>>(`/warehouses/${id}`, data);
    if (!res.data.success || !res.data.data) throw new Error(res.data.message ?? 'Update failed');
    return res.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/warehouses/${id}`);
  },
};

// ─── Rack API (uses Express backend; api from @/lib/api) ──────────────────────
export const rackApi = {
  getAll: async (params?: PaginationParams & { warehouse_id?: string }): Promise<ApiPaginatedResponse<Rack>> => {
    const res = await api.get<ApiPaginatedResponse<Rack>>('/racks', { params });
    console.log(res.data)
    return res.data;
  },
  getById: async (id: string): Promise<Rack> => {
    const res = await api.get<ApiResponse<Rack>>(`/racks/${id}`);
    if (!res.data.success || !res.data.data) throw new Error(res.data.message ?? 'Rack not found');
    return res.data.data;
  },
  create: async (data: CreateRackDto): Promise<Rack> => {
    const res = await api.post<ApiResponse<Rack>>('/racks', data);
    if (!res.data.success || !res.data.data) throw new Error(res.data.message ?? 'Create failed');
    return res.data.data;
  },
  update: async (id: string, data: UpdateRackDto): Promise<Rack> => {
    const res = await api.put<ApiResponse<Rack>>(`/racks/${id}`, data);
    if (!res.data.success || !res.data.data) throw new Error(res.data.message ?? 'Update failed');
    return res.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/racks/${id}`);
  },
  assignProduct: async (data: { product_id: string; rack_id: string; boxes_stored: number }): Promise<any> => {
    const res = await api.post('/racks/assign', data);
    return res.data;
  },
  getProductStorage: async (productId: string): Promise<any> => {
    const res = await api.get(`/racks/product/${productId}`);
    return res.data;
  },
};

// ─── Rack Inventory API ────────────────────────────────────────────────────────
export const rackInventoryApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<any>> => {
    const res = await api.get<ApiPaginatedResponse<any>>('/rack-inventory', { params });
    return res.data;
  },
};

// ─── Category API (may use different backend) ──────────────────────────────────
export const categoryApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<Category>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<Category>>('/categories', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<Category>> => {
    const res = await axiosInstance.get<ApiResponse<Category>>(`/categories/${id}`);
    return res.data;
  },
  create: async (data: CreateCategoryDto): Promise<ApiResponse<Category>> => {
    const res = await axiosInstance.post<ApiResponse<Category>>('/categories', data);
    return res.data;
  },
  update: async (id: string, data: UpdateCategoryDto): Promise<ApiResponse<Category>> => {
    const res = await axiosInstance.put<ApiResponse<Category>>(`/categories/${id}`, data);
    return res.data;
  },
  delete: async (id: string): Promise<ApiResponse<null>> => {
    const res = await axiosInstance.delete<ApiResponse<null>>(`/categories/${id}`);
    return res.data;
  },
};

// ─── Shade API ────────────────────────────────────────────────────────────────
export const shadeApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<Shade>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<Shade>>('/shades', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<Shade>> => {
    const res = await axiosInstance.get<ApiResponse<Shade>>(`/shades/${id}`);
    return res.data;
  },
};

// ─── Batch API ────────────────────────────────────────────────────────────────
export const batchApi = {
  getAll: async (params?: PaginationParams): Promise<ApiPaginatedResponse<Batch>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<Batch>>('/batches', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<Batch>> => {
    const res = await axiosInstance.get<ApiResponse<Batch>>(`/batches/${id}`);
    return res.data;
  },
};
