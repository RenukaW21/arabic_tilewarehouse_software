import axiosInstance from './axios';
import { ApiPaginatedResponse, ApiResponse } from '../types/api.types';
import { Product } from '../types/product.types';

export const productApi = {
  getAll: async (params?: Record<string, string | number>) => {
    const res = await axiosInstance.get<ApiPaginatedResponse<Product>>('/products', { params });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await axiosInstance.get<ApiResponse<Product>>(`/products/${id}`);
    return res.data;
  },

  getShades: async (productId: string) => {
    const res = await axiosInstance.get(`/products/${productId}/shades`);
    return res.data;
  },

  create: async (data: FormData) => {
    const res = await axiosInstance.post<ApiResponse<Product>>('/products', data);
    return res.data;
  },

  update: async (id: string, data: FormData) => {
    const res = await axiosInstance.put<ApiResponse<Product>>(`/products/${id}`, data);
    return res.data;
  },

  delete: async (id: string) => {
    const res = await axiosInstance.delete<ApiResponse<null>>(`/products/${id}`);
    return res.data;
  },
};