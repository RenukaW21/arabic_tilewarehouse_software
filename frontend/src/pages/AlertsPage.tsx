import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alertApi } from '@/api/miscApi';
import { LowStockAlert as Alert } from '@/types/misc.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LOW_STOCK_ALERTS_QUERY_KEY, useLowStockAlerts } from '@/hooks/useLowStockAlerts';

export default function AlertsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: alerts = [], isLoading } = useLowStockAlerts();

  const ackMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await alertApi.update(id, status);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LOW_STOCK_ALERTS_QUERY_KEY });
      toast.success(t('alertsPage.alertUpdated'));
    },
  });

  const columns = [
    {
      key: 'product',
      label: t('alertsPage.product'),
      render: (r: Alert) => (
        <div>
          <span className="font-medium">{r.product_name}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {r.product_code}
          </span>
        </div>
      ),
    },
    {
      key: 'warehouse',
      label: t('alertsPage.warehouse'),
      render: (r: Alert) => r.warehouse_name ?? t('alertsPage.mainWarehouse'),
    },
    {
      key: 'current_stock_boxes',
      label: t('alertsPage.currentStock'),
      render: (r: Alert) => (
        <span className="text-red-600 font-semibold">
          {Number(r.current_stock_boxes)} {t('common.boxes')}
        </span>
      ),
    },
    {
      key: 'reorder_level_boxes',
      label: t('alertsPage.reorderLevel'),
      render: (r: Alert) => `${r.reorder_level_boxes} ${t('common.boxes')}`,
    },
    {
      key: 'status',
      label: t('alertsPage.status'),
      render: (r: Alert) => (
        <StatusBadge status={r.status ?? 'open'} />
      ),
    },
    {
      key: 'actions',
      label: t('alertsPage.actions'),
      render: (r: Alert) => (
        <div className="flex gap-2">
          {r.status === 'open' && r.id && (
            <Button
              size="sm"
              variant="outline"
              disabled={ackMutation.isPending}
              onClick={() =>
                ackMutation.mutate({ id: r.id, status: 'acknowledged' })
              }
            >
              {t('alertsPage.acknowledge')}
            </Button>
          )}

          {r.status !== 'resolved' && r.id && (
            <Button
              size="sm"
              variant="outline"
              disabled={ackMutation.isPending}
              onClick={() =>
                ackMutation.mutate({ id: r.id, status: 'resolved' })
              }
            >
              {t('alertsPage.resolve')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('alertsPage.title')}
        subtitle={t('alertsPage.subtitle')}
      />

      {isLoading ? (
        <p className="text-muted-foreground">{t('alertsPage.loadingAlerts')}</p>
      ) : (
        <DataTableShell
          data={alerts}
          columns={columns}
          searchKey="product_name"
          searchPlaceholder={t('alertsPage.searchProduct')}
        />
      )}
    </div>
  );
}
