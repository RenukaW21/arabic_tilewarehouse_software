import axiosInstance from './axios';
import { ApiResponse, ApiPaginatedResponse, PaginationParams } from '../types/api.types';
import { SalesOrder, CreateSalesOrderDto } from '../types/salesOrder.types';

/**
 * Sales Order API Service
 * Base: /sales-orders
 *
 * Routes:
 *   GET    /sales-orders           — list with pagination
 *   GET    /sales-orders/:id       — single record
 *   POST   /sales-orders           — create draft order
 *   POST   /sales-orders/:id/confirm — confirm order → creates pick list
 */
export const salesOrderApi = {
  /**
   * Get all sales orders with pagination.
   * @param params — { page, limit, search, status, customerId, ... }
   */
  getAll: async (params?: PaginationParams & { status?: string; customerId?: string }): Promise<ApiPaginatedResponse<SalesOrder>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<SalesOrder>>('/sales-orders', { params });
    return res.data;
  },

  /**
   * Get a single sales order by ID (includes items).
   */
  getById: async (id: string): Promise<ApiResponse<SalesOrder>> => {
    const res = await axiosInstance.get<ApiResponse<SalesOrder>>(`/sales-orders/${id}`);
    return res.data;
  },

  /**
   * Create a new draft sales order with line items.
   */
  create: async (data: CreateSalesOrderDto): Promise<ApiResponse<SalesOrder>> => {
    const res = await axiosInstance.post<ApiResponse<SalesOrder>>('/sales-orders', data);
    return res.data;
  },

  /**
   * Confirm a draft order — changes status to pick_ready and auto-creates a pick list.
   * Role required: super_admin | admin | sales
   */
  confirmOrder: async (id: string): Promise<ApiResponse<SalesOrder>> => {
    const res = await axiosInstance.post<ApiResponse<SalesOrder>>(`/sales-orders/${id}/confirm`);
    return res.data;
  },
};
