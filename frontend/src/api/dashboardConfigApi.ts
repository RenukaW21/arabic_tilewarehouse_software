import axiosInstance from './axios';
import type { ApiResponse } from '../types/api.types';
import type { DashboardConfig } from '../types/stock.types';

export const dashboardConfigApi = {
  get: async (): Promise<DashboardConfig> => {
    const res = await axiosInstance.get<ApiResponse<DashboardConfig>>('/dashboard-config');
    if (!res.data.success || !res.data.data) throw new Error('Failed to load dashboard config');
    return res.data.data;
  },

  save: async (config: DashboardConfig): Promise<DashboardConfig> => {
    const res = await axiosInstance.put<ApiResponse<DashboardConfig>>('/dashboard-config', config);
    if (!res.data.success || !res.data.data) throw new Error('Failed to save dashboard config');
    return res.data.data;
  },

  reset: async (): Promise<void> => {
    await axiosInstance.delete('/dashboard-config');
  },
};
