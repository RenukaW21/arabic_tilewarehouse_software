import axiosInstance from './axios';
import { ApiResponse, ApiPaginatedResponse } from '../types/api.types';
import {
  DashboardData,
  DashboardReport,
  GSTReportRow,
  RevenueReportRow,
  AgingReportRow,
  StockValuationRow,
  StockSummary,
  StockLedgerEntry,
  StockLedgerParams,
  StockSummaryParams,
} from '../types/stock.types';

// ─── Report API ───────────────────────────────────────────────────────────────

/**
 * Reports API Service
 * Base: /reports
 *
 * All routes require authentication.
 * GST / Revenue / Aging / Stock Valuation require: super_admin | admin | accountant
 */
export const reportApi = {
  /**
   * Full dashboard — summary, KPIs, low stock, recent sales/purchases, stock by category.
   * Single optimized endpoint; available to all authenticated roles.
   */
  getDashboard: async (): Promise<ApiResponse<DashboardData>> => {
    const res = await axiosInstance.get<ApiResponse<DashboardData>>('/reports/dashboard');
    return res.data;
  },

  /**
   * GST report — GSTR-1 style data.
   * @param params — { from, to } ISO date strings
   */
  getGSTReport: async (params?: { month?: number; year?: number; from?: string; to?: string }): Promise<ApiResponse<GSTReportRow[]>> => {
    const res = await axiosInstance.get<ApiResponse<GSTReportRow[]>>('/reports/gst', { params });
    return res.data;
  },

  /**
   * Revenue report grouped by period.
   * @param params — { from, to, groupBy: 'day'|'month'|'year' }
   */
  getRevenueReport: async (params?: { months?: number; from?: string; to?: string; groupBy?: string }): Promise<ApiResponse<RevenueReportRow[]>> => {
    const res = await axiosInstance.get<ApiResponse<RevenueReportRow[]>>('/reports/revenue', { params });
    return res.data;
  },

  /**
   * Accounts receivable aging report.
   */
  getAgingReport: async (): Promise<ApiResponse<AgingReportRow[]>> => {
    const res = await axiosInstance.get<ApiResponse<AgingReportRow[]>>('/reports/aging');
    return res.data;
  },

  /**
   * Stock valuation — total value of inventory at cost.
   * @param params — { warehouseId }
   */
  getStockValuation: async (params?: { warehouseId?: string }): Promise<ApiResponse<StockValuationRow[]>> => {
    const res = await axiosInstance.get<ApiResponse<StockValuationRow[]>>('/reports/stock-valuation', { params });
    return res.data;
  },
};

// ─── Stock API ────────────────────────────────────────────────────────────────

/**
 * Stock API Service
 * GET /stock/summary  — current stock levels per product/warehouse
 * GET /stock/ledger   — full transaction history (paginated)
 */
export const stockApi = {
  /**
   * Get stock summary for all products.
   * Optionally filter by warehouseId, productId, or lowStock flag.
   */
  getSummary: async (params?: StockSummaryParams): Promise<ApiResponse<StockSummary[]>> => {
    const queryParams = params ? {
      ...(params.warehouseId && { warehouseId: params.warehouseId }),
      ...(params.productId && { productId: params.productId }),
      ...(params.lowStock && { lowStock: 'true' }),
    } : undefined;
    const res = await axiosInstance.get<ApiResponse<StockSummary[]>>('/stock/summary', { params: queryParams });
    return res.data;
  },

  /**
   * Get paginated stock ledger — full transaction history.
   */
  getLedger: async (params?: StockLedgerParams): Promise<ApiPaginatedResponse<StockLedgerEntry>> => {
    const queryParams = params ? {
      ...(params.productId && { productId: params.productId }),
      ...(params.warehouseId && { warehouseId: params.warehouseId }),
      ...(params.type && { type: params.type }),
      ...(params.from && { from: params.from }),
      ...(params.to && { to: params.to }),
      ...(params.page && { page: params.page }),
      ...(params.limit && { limit: params.limit }),
    } : undefined;
    const res = await axiosInstance.get<ApiPaginatedResponse<StockLedgerEntry>>('/stock/ledger', { params: queryParams });
    return res.data;
  },
};
