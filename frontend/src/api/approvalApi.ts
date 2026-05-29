import axiosInstance from './axios';
import { ApiResponse, ApiPaginatedResponse } from '../types/api.types';

export type ApprovalRequestType =
  | 'inventory_adjustment'
  | 'production_entry'
  | 'purchase_approval'
  | 'pricing_change'
  | 'marketplace_update'
  | 'report_validation';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  tenant_id: string;
  request_type: ApprovalRequestType;
  reference_id: string;
  reference_type: string;
  title: string;
  description: string | null;
  payload: Record<string, unknown> | null;
  status: ApprovalStatus;
  submitted_by: string;
  submitter_name: string | null;
  submitter_email: string | null;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  pending_adj: number;
  pending_prod: number;
  pending_po: number;
  pending_price: number;
  pending_market: number;
  pending_report: number;
}

export interface ApprovalListParams {
  status?: ApprovalStatus;
  request_type?: ApprovalRequestType;
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateApprovalRequestData {
  request_type: ApprovalRequestType;
  reference_id: string;
  reference_type: string;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
}

export const approvalApi = {
  getAll: async (params?: ApprovalListParams): Promise<ApiPaginatedResponse<ApprovalRequest>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<ApprovalRequest>>('/approval-requests', { params });
    return res.data;
  },

  getStats: async (): Promise<ApiResponse<ApprovalStats>> => {
    const res = await axiosInstance.get<ApiResponse<ApprovalStats>>('/approval-requests/stats');
    return res.data;
  },

  getById: async (id: string): Promise<ApiResponse<ApprovalRequest>> => {
    const res = await axiosInstance.get<ApiResponse<ApprovalRequest>>(`/approval-requests/${id}`);
    return res.data;
  },

  create: async (data: CreateApprovalRequestData): Promise<ApiResponse<ApprovalRequest>> => {
    const res = await axiosInstance.post<ApiResponse<ApprovalRequest>>('/approval-requests', data);
    return res.data;
  },

  approve: async (id: string, review_notes?: string): Promise<ApiResponse<ApprovalRequest>> => {
    const res = await axiosInstance.post<ApiResponse<ApprovalRequest>>(
      `/approval-requests/${id}/approve`,
      { review_notes: review_notes || '' }
    );
    return res.data;
  },

  reject: async (id: string, review_notes?: string): Promise<ApiResponse<ApprovalRequest>> => {
    const res = await axiosInstance.post<ApiResponse<ApprovalRequest>>(
      `/approval-requests/${id}/reject`,
      { review_notes: review_notes || '' }
    );
    return res.data;
  },
};
