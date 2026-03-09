import axiosInstance from './axios';
import {
  ApiResponse,
} from '../types/api.types';
import {
  LoginDto,
  LoginResponseData,
  RegisterTenantDto,
  RefreshTokenDto,
  RefreshResponseData,
  ChangePasswordDto,
  AuthUser,
} from '../types/auth.types';

/**
 * Auth API Service
 * Endpoints: POST /auth/login | /auth/refresh | /auth/logout | /auth/register
 *            GET  /auth/profile
 *            PUT  /auth/change-password
 */
export const authApi = {
  /**
   * Login with email + password.
   * Returns user object and JWT tokens.
   */
  login: async (data: LoginDto): Promise<ApiResponse<LoginResponseData>> => {
    const res = await axiosInstance.post<ApiResponse<LoginResponseData>>('/auth/login', data);
    return res.data;
  },

  /**
   * Register a new tenant (company) with an initial admin user.
   */
  register: async (data: RegisterTenantDto): Promise<ApiResponse<{ tenantId: string; userId: string }>> => {
    const res = await axiosInstance.post('/auth/register', data);
    return res.data;
  },

  /**
   * Exchange a refresh token for a new access token.
   */
  refresh: async (data: RefreshTokenDto): Promise<ApiResponse<RefreshResponseData>> => {
    const res = await axiosInstance.post<ApiResponse<RefreshResponseData>>('/auth/refresh', data);
    return res.data;
  },

  /**
   * Logout — invalidates the refresh token on the server.
   */
  logout: async (refreshToken: string): Promise<ApiResponse<Record<string, never>>> => {
    const res = await axiosInstance.post<ApiResponse<Record<string, never>>>('/auth/logout', { refreshToken });
    return res.data;
  },

  /**
   * Get logged-in user's profile.
   * Requires valid Bearer token (attached automatically by interceptor).
   */
  getProfile: async (): Promise<ApiResponse<AuthUser>> => {
    const res = await axiosInstance.get<ApiResponse<AuthUser>>('/auth/profile');
    return res.data;
  },

  /**
   * Change the current user's password.
   */
  changePassword: async (data: ChangePasswordDto): Promise<ApiResponse<Record<string, never>>> => {
    const res = await axiosInstance.put<ApiResponse<Record<string, never>>>('/auth/change-password', data);
    return res.data;
  },
};
