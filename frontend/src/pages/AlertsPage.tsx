import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function AlertsPage() {
  const qc = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['low_stock_alerts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('low_stock_alerts').select('*, products(name, code), warehouses(name)').order('alerted_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const ackMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === 'resolved') update.resolved_at = new Date().toISOString();
      const { error } = await supabase.from('low_stock_alerts').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['low_stock_alerts'] }); toast.success('Alert updated'); },
    onError: (e: any) => toast.error(e.message),
  });

  const columns = [
    { key: 'product', label: 'Product', render: (r: any) => (
      <div>
        <span className="font-medium">{(r as any).products?.name || '—'}</span>
        <span className="text-xs text-muted-foreground ml-2">{(r as any).products?.code}</span>
      </div>
    )},
    { key: 'warehouse', label: 'Warehouse', render: (r: any) => (r as any).warehouses?.name || '—' },
    { key: 'current_stock_boxes', label: 'Current Stock' },
    { key: 'reorder_level_boxes', label: 'Reorder Level' },
    { key: 'status', label: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: 'Actions', render: (r: any) => (
      <div className="flex gap-1">
        {r.status === 'open' && <Button variant="outline" size="sm" onClick={() => ackMutation.mutate({ id: r.id, status: 'acknowledged' })}>Acknowledge</Button>}
        {r.status !== 'resolved' && <Button variant="outline" size="sm" onClick={() => ackMutation.mutate({ id: r.id, status: 'resolved' })}>Resolve</Button>}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Low Stock Alerts" subtitle="Monitor stock levels" />
      {isLoading ? <p className="text-muted-foreground">Loading...</p> : <DataTableShell data={alerts} columns={columns} searchKey="status" searchPlaceholder="Filter by status..." />}
    </div>
  );
}
