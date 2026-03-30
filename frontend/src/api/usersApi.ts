/**
 * Users API — list, get, create, update, deactivate.
 * Only super_admin and admin can access.
 * Base: /users
 */
import axiosInstance from './axios';
import type { ApiResponse, ApiPaginatedResponse, PaginationParams } from '@/types/api.types';

export const ROLES = [
  'super_admin',
  'admin',
  'warehouse_manager',
  'supervisor',
  'sales',
  'accountant',
  'warehouse_staff',
  'viewer',
  'user',
] as const;
export type UserRole = (typeof ROLES)[number];

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean | number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string | null;
}

export interface UpdateUserDto {
  name?: string;
  password?: string | null;
  role?: UserRole;
  phone?: string | null;
  is_active?: boolean;
}

export interface UsersListParams extends PaginationParams {
  /** Filter by role(s). Backend accepts: role=warehouse_manager,sales or role[]=a&role[]=b */
  role?: UserRole | UserRole[] | string;
  is_active?: boolean | string;
}

export interface UserLookup {
  id: string;
  name: string;
  role: UserRole;
}

export const usersApi = {
  /** Minimal lookup — id, name, role only. Accessible to all authenticated roles. */
  lookup: (roles?: UserRole[] | string) => {
    const params: Record<string, string> = {};
    if (roles) {
      params.role = Array.isArray(roles) ? roles.join(',') : roles;
    }
    return axiosInstance
      .get<{ data: UserLookup[] }>('/users/lookup', { params })
      .then((r) => r.data);
  },

  getAll: (params?: UsersListParams) => {
    const p = { ...params };
    if (Array.isArray(p?.role)) {
      (p as Record<string, unknown>).role = p.role.join(',');
    }
    return axiosInstance.get<ApiPaginatedResponse<User>>('/users', { params: p }).then((r) => r.data);
  },

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<User>>(`/users/${id}`).then((r) => r.data),

  create: (data: CreateUserDto) =>
    axiosInstance.post<ApiResponse<User>>('/users', data).then((r) => r.data),

  update: (id: string, data: UpdateUserDto) =>
    axiosInstance.put<ApiResponse<User>>(`/users/${id}`, data).then((r) => r.data),

  deactivate: (id: string) =>
    axiosInstance.delete<ApiResponse<User>>(`/users/${id}`).then((r) => r.data),
};
