import axiosInstance from './axios';
import type { ApiResponse, ApiPaginatedResponse, PaginationParams } from '@/types/api.types';

export interface DamageEntry {
  id: string;
  tenant_id: string;
  warehouse_id: string;
  product_id: string;
  shade_id?: string | null;
  batch_id?: string | null;
  rack_id?: string | null;
  damage_date: string;
  damaged_boxes: number;
  damaged_pieces: number;
  damage_reason?: string | null;
  estimated_loss?: number | null;
  created_by?: string;
  created_at?: string;
  notes?: string | null;
  product_name?: string;
  product_code?: string;
  warehouse_name?: string;
}

export interface CreateDamageEntryPayload {
  warehouse_id: string;
  product_id: string;
  shade_id?: string | null;
  batch_id?: string | null;
  rack_id?: string | null;
  damage_date?: string;
  damaged_boxes: number;
  damaged_pieces?: number;
  damage_reason?: string | null;
  estimated_loss?: number | null;
  notes?: string | null;
}

export interface DamageEntryListParams extends PaginationParams {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const damageEntriesApi = {
  getAll: (params?: DamageEntryListParams) =>
    axiosInstance.get<ApiPaginatedResponse<DamageEntry>>('/damage-entries', { params }).then(r => r.data),
  getById: (id: string) =>
    axiosInstance.get<ApiResponse<DamageEntry>>(`/damage-entries/${id}`).then(r => r.data),
  create: (payload: CreateDamageEntryPayload) =>
    axiosInstance.post<ApiResponse<DamageEntry>>('/damage-entries', payload).then(r => r.data),
  update: (id: string, payload: Partial<CreateDamageEntryPayload>) =>
    axiosInstance.put<ApiResponse<DamageEntry>>(`/damage-entries/${id}`, payload).then(r => r.data),
  delete: (id: string) =>
    axiosInstance.delete(`/damage-entries/${id}`),
};
