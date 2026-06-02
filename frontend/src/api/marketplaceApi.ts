import axiosInstance from './axios';
import { ApiResponse, ApiPaginatedResponse } from '../types/api.types';

export type MarketplacePlatform = 'amazon' | 'flipkart' | 'meesho';
export type FulfillmentType = 'fbm' | 'fba';

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type ReturnStatus = 'initiated' | 'received' | 'restocked' | 'rejected';
export type ListingStatus = 'active' | 'inactive' | 'pending' | 'error';
export type SyncStatus = 'success' | 'error' | 'partial';

// ─── Credentials ──────────────────────────────────────────────────────────────

export interface MarketplaceCredential {
  id: string;
  tenant_id: string;
  platform: MarketplacePlatform;
  display_name: string | null;
  seller_id: string | null;
  marketplace_id: string | null;
  fulfillment_type: FulfillmentType | null;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveCredentialData {
  display_name?: string;
  seller_id?: string;
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  refresh_token?: string;
  marketplace_id?: string;
  fulfillment_type?: FulfillmentType | null;
  is_active?: boolean;
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

export interface MarketplacePricing {
  id: string;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  platform: MarketplacePlatform;
  price: number;
  updated_by: string;
  updated_by_name: string | null;
  updated_at: string;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface MarketplaceOrder {
  id: string;
  platform: MarketplacePlatform;
  platform_order_id: string;
  platform_order_date: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: OrderStatus;
  total_amount: number | null;
  currency: string;
  tracking_number: string | null;
  shipped_at: string | null;
  wms_sales_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceOrderStats {
  total: number;
  pending: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  returned: number;
  amazon_total: number;
  flipkart_total: number;
  meesho_total: number;
}

// ─── Returns ──────────────────────────────────────────────────────────────────

export interface MarketplaceReturn {
  id: string;
  platform: MarketplacePlatform;
  platform_return_id: string;
  marketplace_order_id: string | null;
  platform_order_id: string | null;
  return_reason: string | null;
  return_quantity: number;
  status: ReturnStatus;
  wms_return_id: string | null;
  restocked_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export interface SyncLog {
  id: string;
  platform: MarketplacePlatform;
  sync_type: string;
  status: SyncStatus;
  records_in: number;
  records_out: number;
  error_msg: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface SyncHealth {
  logs: SyncLog[];
  credentials: { platform: MarketplacePlatform; is_active: boolean; last_sync_at: string | null }[];
}

// ─── API client ───────────────────────────────────────────────────────────────

export const marketplaceApi = {
  // Credentials
  credentials: {
    getAll: async (): Promise<ApiResponse<MarketplaceCredential[]>> => {
      const res = await axiosInstance.get('/marketplace/credentials');
      return res.data;
    },
    getByPlatform: async (platform: MarketplacePlatform): Promise<ApiResponse<MarketplaceCredential>> => {
      const res = await axiosInstance.get(`/marketplace/credentials/${platform}`);
      return res.data;
    },
    save: async (platform: MarketplacePlatform, data: SaveCredentialData): Promise<ApiResponse<MarketplaceCredential>> => {
      const res = await axiosInstance.put(`/marketplace/credentials/${platform}`, data);
      return res.data;
    },
    remove: async (id: string): Promise<void> => {
      await axiosInstance.delete(`/marketplace/credentials/${id}`);
    },
  },

  // Pricing
  pricing: {
    getAll: async (params?: { platform?: MarketplacePlatform; product_id?: string; page?: number; limit?: number }): Promise<ApiPaginatedResponse<MarketplacePricing>> => {
      const res = await axiosInstance.get('/marketplace/pricing', { params });
      return res.data;
    },
    upsert: async (data: { product_id: string; platform: MarketplacePlatform; price: number }): Promise<ApiResponse<MarketplacePricing>> => {
      const res = await axiosInstance.post('/marketplace/pricing', data);
      return res.data;
    },
    remove: async (productId: string, platform: MarketplacePlatform): Promise<void> => {
      await axiosInstance.delete(`/marketplace/pricing/${productId}/${platform}`);
    },
  },

  // Orders
  orders: {
    getAll: async (params?: { platform?: MarketplacePlatform; status?: OrderStatus; page?: number; limit?: number; search?: string }): Promise<ApiPaginatedResponse<MarketplaceOrder>> => {
      const res = await axiosInstance.get('/marketplace/orders', { params });
      return res.data;
    },
    getById: async (id: string): Promise<ApiResponse<MarketplaceOrder>> => {
      const res = await axiosInstance.get(`/marketplace/orders/${id}`);
      return res.data;
    },
    getStats: async (): Promise<ApiResponse<MarketplaceOrderStats>> => {
      const res = await axiosInstance.get('/marketplace/orders/stats');
      return res.data;
    },
    updateStatus: async (id: string, data: { status: OrderStatus; tracking_number?: string; shipped_at?: string; wms_sales_order_id?: string }): Promise<ApiResponse<MarketplaceOrder>> => {
      const res = await axiosInstance.patch(`/marketplace/orders/${id}/status`, data);
      return res.data;
    },
  },

  // Returns
  returns: {
    getAll: async (params?: { platform?: MarketplacePlatform; status?: ReturnStatus; page?: number; limit?: number; search?: string }): Promise<ApiPaginatedResponse<MarketplaceReturn>> => {
      const res = await axiosInstance.get('/marketplace/returns', { params });
      return res.data;
    },
    getById: async (id: string): Promise<ApiResponse<MarketplaceReturn>> => {
      const res = await axiosInstance.get(`/marketplace/returns/${id}`);
      return res.data;
    },
    updateStatus: async (id: string, data: { status: ReturnStatus; wms_return_id?: string; restocked_at?: string }): Promise<ApiResponse<MarketplaceReturn>> => {
      const res = await axiosInstance.patch(`/marketplace/returns/${id}/status`, data);
      return res.data;
    },
  },

  // Sync
  sync: {
    getHealth: async (): Promise<ApiResponse<SyncHealth>> => {
      const res = await axiosInstance.get('/marketplace/sync/health');
      return res.data;
    },
    getLogs: async (params?: { platform?: MarketplacePlatform; sync_type?: string; page?: number; limit?: number }): Promise<ApiPaginatedResponse<SyncLog>> => {
      const res = await axiosInstance.get('/marketplace/sync/logs', { params });
      return res.data;
    },
  },
};
