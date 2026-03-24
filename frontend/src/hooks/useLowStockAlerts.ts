import { useQuery } from '@tanstack/react-query';
import { alertApi } from '@/api/miscApi';
import type { LowStockAlert } from '@/types/misc.types';

export const LOW_STOCK_ALERTS_QUERY_KEY = ['low_stock_alerts'] as const;

export function useLowStockAlerts() {
  return useQuery({
    queryKey: LOW_STOCK_ALERTS_QUERY_KEY,
    queryFn: async (): Promise<LowStockAlert[]> => {
      const res = await alertApi.getLowStock();
      return res.data ?? [];
    },
  });
}
