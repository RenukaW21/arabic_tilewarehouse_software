import axiosInstance from './axios';
import type { ApiResponse, ApiPaginatedResponse, PaginationParams } from '@/types/api.types';

export type ProductionStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';

export interface ProductionMaterial {
  id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  planned_qty: number;
  actual_qty?: number;
  unit_cost?: number;
  line_total?: number;
}

export interface ProductionOutput {
  id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  planned_qty: number;
  actual_qty?: number;
  wastage_qty?: number;
  unit_cost?: number;
  line_total?: number;
}

export interface ProductionOrder {
  id: string;
  tenant_id: string;
  order_number: string;
  status: ProductionStatus;
  warehouse_id: string;
  warehouse_name?: string;
  planned_date: string;
  completion_date?: string | null;
  labor_cost: number;
  machine_cost: number;
  wastage_cost: number;
  total_material_cost: number;
  total_cost: number;
  notes?: string | null;
  created_by?: string;
  created_by_name?: string;
  material_count?: number;
  output_count?: number;
  materials?: ProductionMaterial[];
  outputs?: ProductionOutput[];
  created_at: string;
  updated_at: string;
}

export interface CreateProductionOrderDto {
  warehouse_id: string;
  planned_date: string;
  labor_cost?: number;
  machine_cost?: number;
  wastage_cost?: number;
  notes?: string;
  materials?: Omit<ProductionMaterial, 'id' | 'product_name' | 'product_code' | 'line_total'>[];
  outputs?: Omit<ProductionOutput, 'id' | 'product_name' | 'product_code' | 'line_total'>[];
}

export interface ProductionOrderListParams extends PaginationParams {
  status?: ProductionStatus;
  warehouse_id?: string;
}

// ─── Batches ──────────────────────────────────────────────────────────────────

export type BatchStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export interface ProductionBatch {
  id: string;
  tenant_id: string;
  batch_number: string;
  production_order_id?: string | null;
  production_order_number?: string | null;
  status: BatchStatus;
  warehouse_id: string;
  warehouse_name?: string;
  product_id?: string | null;
  product_name?: string | null;
  product_code?: string | null;
  quantity_planned: number;
  quantity_produced: number;
  wastage_qty: number;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBatchDto {
  warehouse_id: string;
  production_order_id?: string | null;
  product_id?: string | null;
  quantity_planned: number;
  start_date?: string | null;
  notes?: string | null;
}

export interface BatchListParams extends PaginationParams {
  status?: BatchStatus;
  warehouse_id?: string;
  production_order_id?: string;
}

export const productionBatchApi = {
  getAll: async (params?: BatchListParams): Promise<ApiPaginatedResponse<ProductionBatch>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<ProductionBatch>>('/production-batches', { params });
    return res.data;
  },

  getById: async (id: string): Promise<ApiResponse<ProductionBatch>> => {
    const res = await axiosInstance.get<ApiResponse<ProductionBatch>>(`/production-batches/${id}`);
    return res.data;
  },

  create: async (data: CreateBatchDto): Promise<ApiResponse<ProductionBatch>> => {
    const res = await axiosInstance.post<ApiResponse<ProductionBatch>>('/production-batches', data);
    return res.data;
  },

  update: async (id: string, data: Partial<CreateBatchDto>): Promise<ApiResponse<ProductionBatch>> => {
    const res = await axiosInstance.put<ApiResponse<ProductionBatch>>(`/production-batches/${id}`, data);
    return res.data;
  },

  updateStatus: async (
    id: string,
    status: BatchStatus,
    extra?: { quantity_produced?: number; wastage_qty?: number; end_date?: string }
  ): Promise<ApiResponse<ProductionBatch>> => {
    const res = await axiosInstance.patch<ApiResponse<ProductionBatch>>(`/production-batches/${id}/status`, { status, ...extra });
    return res.data;
  },

  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    const res = await axiosInstance.delete<ApiResponse<{ success: boolean }>>(`/production-batches/${id}`);
    return res.data;
  },
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface MaterialRecord {
  id: string;
  production_order_id: string;
  order_number: string;
  order_status: ProductionStatus;
  warehouse_name: string;
  product_id: string;
  product_name: string;
  product_code: string;
  planned_qty: number;
  actual_qty: number;
  unit_cost: number;
  line_total: number;
  created_at: string;
}

export interface OutputRecord {
  id: string;
  production_order_id: string;
  order_number: string;
  order_status: ProductionStatus;
  warehouse_name: string;
  product_id: string;
  product_name: string;
  product_code: string;
  planned_qty: number;
  actual_qty: number;
  wastage_qty: number;
  unit_cost: number;
  line_total: number;
  created_at: string;
}

export interface CostSummaryRow {
  id: string;
  order_number: string;
  status: ProductionStatus;
  warehouse_name: string;
  planned_date: string;
  completion_date?: string | null;
  labor_cost: number;
  machine_cost: number;
  wastage_cost: number;
  total_material_cost: number;
  total_cost: number;
}

export interface CostSummaryTotals {
  total_labor: number;
  total_machine: number;
  total_wastage: number;
  total_material: number;
  grand_total: number;
}

export const productionOrderApi = {
  getAllMaterials: async (params?: Record<string, any>): Promise<ApiPaginatedResponse<MaterialRecord>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<MaterialRecord>>('/production-orders/materials', { params });
    return res.data;
  },

  getAllOutputs: async (params?: Record<string, any>): Promise<ApiPaginatedResponse<OutputRecord>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<OutputRecord>>('/production-orders/outputs', { params });
    return res.data;
  },

  getCostSummary: async (params?: Record<string, any>): Promise<{ data: CostSummaryRow[]; summary: CostSummaryTotals; meta: any }> => {
    const res = await axiosInstance.get('/production-orders/cost-summary', { params });
    return res.data;
  },

  getAll: async (params?: ProductionOrderListParams): Promise<ApiPaginatedResponse<ProductionOrder>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<ProductionOrder>>('/production-orders', { params });
    return res.data;
  },

  getById: async (id: string): Promise<ApiResponse<ProductionOrder>> => {
    const res = await axiosInstance.get<ApiResponse<ProductionOrder>>(`/production-orders/${id}`);
    return res.data;
  },

  create: async (data: CreateProductionOrderDto): Promise<ApiResponse<ProductionOrder>> => {
    const res = await axiosInstance.post<ApiResponse<ProductionOrder>>('/production-orders', data);
    return res.data;
  },

  update: async (id: string, data: Partial<CreateProductionOrderDto>): Promise<ApiResponse<ProductionOrder>> => {
    const res = await axiosInstance.put<ApiResponse<ProductionOrder>>(`/production-orders/${id}`, data);
    return res.data;
  },

  updateStatus: async (id: string, status: ProductionStatus): Promise<ApiResponse<ProductionOrder>> => {
    const res = await axiosInstance.patch<ApiResponse<ProductionOrder>>(`/production-orders/${id}/status`, { status });
    return res.data;
  },

  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    const res = await axiosInstance.delete<ApiResponse<{ success: boolean }>>(`/production-orders/${id}`);
    return res.data;
  },
};
