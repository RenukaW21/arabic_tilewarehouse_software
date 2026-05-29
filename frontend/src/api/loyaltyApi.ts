import axiosInstance from "./axios";
import type { ApiPaginatedResponse, ApiResponse } from "@/types/api.types";
import type {
  LoyaltyCustomer,
  LoyaltyListParams,
  LoyaltyOverview,
  LoyaltyPromotion,
  LoyaltyReferral,
  LoyaltySettings,
  LoyaltyTransaction,
} from "@/types/loyalty.types";

export const loyaltyApi = {
  getOverview: async (): Promise<ApiResponse<LoyaltyOverview>> => {
    const res = await axiosInstance.get<ApiResponse<LoyaltyOverview>>("/loyalty/overview");
    return res.data;
  },

  getSettings: async (): Promise<ApiResponse<LoyaltySettings>> => {
    const res = await axiosInstance.get<ApiResponse<LoyaltySettings>>("/loyalty/settings");
    return res.data;
  },

  updateSettings: async (data: Partial<LoyaltySettings>): Promise<ApiResponse<LoyaltySettings>> => {
    const res = await axiosInstance.put<ApiResponse<LoyaltySettings>>("/loyalty/settings", data);
    return res.data;
  },

  getCustomers: async (params?: LoyaltyListParams): Promise<ApiPaginatedResponse<LoyaltyCustomer>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<LoyaltyCustomer>>("/loyalty/customers", { params });
    return res.data;
  },

  getTransactions: async (params?: LoyaltyListParams): Promise<ApiPaginatedResponse<LoyaltyTransaction>> => {
    const res = await axiosInstance.get<ApiPaginatedResponse<LoyaltyTransaction>>("/loyalty/transactions", { params });
    return res.data;
  },

  createTransaction: async (data: Partial<LoyaltyTransaction>): Promise<ApiResponse<{ id: string }>> => {
    const res = await axiosInstance.post<ApiResponse<{ id: string }>>("/loyalty/transactions", data);
    return res.data;
  },

  getPromotions: async (): Promise<ApiResponse<LoyaltyPromotion[]>> => {
    const res = await axiosInstance.get<ApiResponse<LoyaltyPromotion[]>>("/loyalty/promotions");
    return res.data;
  },

  createPromotion: async (data: Partial<LoyaltyPromotion>): Promise<ApiResponse<LoyaltyPromotion>> => {
    const res = await axiosInstance.post<ApiResponse<LoyaltyPromotion>>("/loyalty/promotions", data);
    return res.data;
  },

  updatePromotion: async (id: string, data: Partial<LoyaltyPromotion>): Promise<ApiResponse<LoyaltyPromotion>> => {
    const res = await axiosInstance.put<ApiResponse<LoyaltyPromotion>>(`/loyalty/promotions/${id}`, data);
    return res.data;
  },

  getReferrals: async (): Promise<ApiResponse<LoyaltyReferral[]>> => {
    const res = await axiosInstance.get<ApiResponse<LoyaltyReferral[]>>("/loyalty/referrals");
    return res.data;
  },

  createReferral: async (data: Partial<LoyaltyReferral>): Promise<ApiResponse<LoyaltyReferral>> => {
    const res = await axiosInstance.post<ApiResponse<LoyaltyReferral>>("/loyalty/referrals", data);
    return res.data;
  },

  completeReferral: async (id: string): Promise<ApiResponse<LoyaltyReferral>> => {
    const res = await axiosInstance.post<ApiResponse<LoyaltyReferral>>(`/loyalty/referrals/${id}/complete`);
    return res.data;
  },
};
