import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Alert {
  id?: string;
  product_name: string;
  product_code: string;
  warehouse_name?: string;
  current_stock_boxes: number;
  reorder_level_boxes: number;
  status?: string;
}

export default function AlertsPage() {
  const qc = useQueryClient();

  // 🔹 Fetch alerts
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['low_stock_alerts'],
    queryFn: async () => {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/alerts/low-stock`);

      const data = res.data.data;
      console.log("data",data);

      // ensure array
      if (!data) return [];

      return Array.isArray(data) ? data : [data];
    },
  });

  // 🔹 Update alert status
  const ackMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await axios.patch(`/api/v1/alerts/${id}`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['low_stock_alerts'] });
      toast.success('Alert updated');
    },
    onError: () => toast.error('Failed to update alert'),
  });

  const columns = [
    {
      key: 'product',
      label: 'Product',
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
      label: 'Warehouse',
      render: (r: Alert) => r.warehouse_name ?? 'Main Warehouse',
    },
    {
      key: 'current_stock_boxes',
      label: 'Current Stock',
      render: (r: Alert) => (
        <span className="text-red-600 font-semibold">
          {Number(r.current_stock_boxes)} boxes
        </span>
      ),
    },
    {
      key: 'reorder_level_boxes',
      label: 'Reorder Level',
      render: (r: Alert) => `${r.reorder_level_boxes} boxes`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Alert) => (
        <StatusBadge status={r.status ?? 'open'} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: Alert) => (
        <div className="flex gap-2">
          {r.status === 'open' && r.id && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                ackMutation.mutate({ id: r.id, status: 'acknowledged' })
              }
            >
              Acknowledge
            </Button>
          )}

          {r.status !== 'resolved' && r.id && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                ackMutation.mutate({ id: r.id, status: 'resolved' })
              }
            >
              Resolve
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Low Stock Alerts"
        subtitle="Monitor warehouse stock levels"
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading alerts...</p>
      ) : (
        <DataTableShell
          data={alerts}
          columns={columns}
          searchKey="product_name"
          searchPlaceholder="Search product..."
        />
      )}
    </div>
  );
}