import { useQuery } from '@tanstack/react-query';
import { reportApi } from '@/api/reportApi';
import type { DashboardData } from '@/types/stock.types';

/**
 * Single dashboard query — one API call returns summary, KPIs, low stock, recent sales/purchases, stock by category.
 * Use data.summary, data.lowStock, data.recentSales, data.recentPurchases, data.stockByCategory, data.kpis.
 */
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<DashboardData> => {
      const res = await reportApi.getDashboard();
      if (!res.success || !res.data) {
        throw new Error(res.message ?? 'Failed to load dashboard');
      }
      return res.data;
    },
    staleTime: 60_000,
  });
}

/** Dashboard KPIs only (convenience). Prefer useDashboard() for a single request. */
export function useDashboardKPIs() {
  const q = useDashboard();
  return {
    ...q,
    data: q.data?.kpis,
  };
}

/** Recent sales orders (from dashboard payload). */
export function useRecentSalesOrders() {
  const q = useDashboard();
  return {
    ...q,
    data: q.data?.recentSales ?? [],
  };
}

/** Low stock alerts (from dashboard payload). */
export function useLowStockAlerts() {
  const q = useDashboard();
  return {
    ...q,
    data: q.data?.lowStock ?? [],
  };
}

/** Stock by category for charts (from dashboard payload). */
export function useStockByCategory() {
  const q = useDashboard();
  return {
    ...q,
    data: q.data?.stockByCategory ?? [],
  };
}

/** Recent purchases (from dashboard payload). */
export function useRecentPurchases() {
  const q = useDashboard();
  return {
    ...q,
    data: q.data?.recentPurchases ?? [],
  };
}
