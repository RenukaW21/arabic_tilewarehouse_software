import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { dashboardConfigApi } from '@/api/dashboardConfigApi';
import type { DashboardConfig } from '@/types/stock.types';

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  widgets: {
    kpi_summary: true,
    kpi_secondary: true,
    chart_stock_by_category: true,
    table_recent_sales: true,
    table_recent_purchases: true,
    table_recent_grns: true,
    table_recent_transfers: true,
    table_low_stock: true,
    quick_actions: true,
  },
  kpis: {
    warehouses: true,
    products: true,
    vendors: true,
    customers: true,
    pending_pos: true,
    total_stock: true,
    monthly_sales: true,
    monthly_purchases: true,
    today_sales: true,
    month_revenue: true,
    unpaid_invoices: true,
    low_stock_count: true,
    active_pos: true,
    ledger_entries: true,
  },
  quick_actions: ['new_sale', 'new_purchase_order', 'new_grn', 'new_stock_transfer'],
};

export function useDashboardConfig() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['dashboard-config'],
    queryFn: dashboardConfigApi.get,
    staleTime: 5 * 60 * 1000,
    placeholderData: DEFAULT_DASHBOARD_CONFIG,
  });

  const saveMutation = useMutation({
    mutationFn: dashboardConfigApi.save,
    onSuccess: (data) => {
      qc.setQueryData(['dashboard-config'], data);
      toast.success(t('dashboardConfig.saved'));
    },
    onError: () => toast.error(t('dashboardConfig.saveFailed')),
  });

  const resetMutation = useMutation({
    mutationFn: dashboardConfigApi.reset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-config'] });
      toast.success(t('dashboardConfig.reset'));
    },
    onError: () => toast.error(t('dashboardConfig.saveFailed')),
  });

  return {
    config: query.data ?? DEFAULT_DASHBOARD_CONFIG,
    isLoading: query.isLoading,
    saveMutation,
    resetMutation,
  };
}
