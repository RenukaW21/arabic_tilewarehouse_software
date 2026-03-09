/**
 * GST Configuration API — full CRUD for gst_configurations (tenant-scoped).
 * Backend: GET/POST/PUT/DELETE /api/v1/setup/gst (GET returns single config per tenant).
 * Uses shared axios instance (baseURL from VITE_API_BASE_URL or VITE_API_URL).
 */
import axiosInstance from './axios';
import type { ApiResponse } from '@/types/api.types';

const BASE = '/setup/gst';

export interface GstConfiguration {
  id: string;
  tenant_id: string;
  gstin: string;
  legal_name: string;
  trade_name: string | null;
  state_code: string;
  state_name: string;
  pan: string | null;
  default_gst_rate: number;
  fiscal_year_start: string | null;
  invoice_prefix: string | null;
  is_composition_scheme: boolean | number;
  created_at: string;
  updated_at: string;
}

export interface CreateGstConfigDto {
  gstin: string;
  legal_name: string;
  trade_name?: string | null;
  state_code: string;
  state_name: string;
  pan?: string | null;
  default_gst_rate?: number;
  fiscal_year_start?: string | null;
  invoice_prefix?: string | null;
  is_composition_scheme?: boolean;
}

export type UpdateGstConfigDto = Partial<CreateGstConfigDto>;

export const gstApi = {
  /** Get GST config for current tenant (single or null). */
  getByTenant: () =>
    axiosInstance.get<ApiResponse<GstConfiguration | null>>(BASE).then((r) => r.data),

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<GstConfiguration>>(`${BASE}/${id}`).then((r) => r.data),

  create: (data: CreateGstConfigDto) =>
    axiosInstance.post<ApiResponse<GstConfiguration>>(BASE, data).then((r) => r.data),

  update: (id: string, data: UpdateGstConfigDto) =>
    axiosInstance.put<ApiResponse<GstConfiguration>>(`${BASE}/${id}`, data).then((r) => r.data),

  remove: (id: string) => axiosInstance.delete(`${BASE}/${id}`),
};
