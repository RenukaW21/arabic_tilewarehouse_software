import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';

export default function StockPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['stock_summary'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_summary').select('*, products(name, code), warehouses(name)').order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const columns = [
    { key: 'product_code', label: 'Code', render: (r: any) => <span className="font-mono-code text-sm font-medium">{(r as any).products?.code || '—'}</span> },
    { key: 'product_name', label: 'Product', render: (r: any) => (r as any).products?.name || '—' },
    { key: 'warehouse', label: 'Warehouse', render: (r: any) => (r as any).warehouses?.name || '—' },
    { key: 'total_boxes', label: 'Boxes', render: (r: any) => Number(r.total_boxes || 0) },
    { key: 'total_pieces', label: 'Pieces', render: (r: any) => Number(r.total_pieces || 0) },
    { key: 'total_sqft', label: 'Total Sqft', render: (r: any) => Number(r.total_sqft || 0).toLocaleString() },
  ];

  return (
    <div>
      <PageHeader title="Stock Summary" subtitle="Current stock levels across warehouses" />
      {isLoading ? <p className="text-muted-foreground">Loading...</p> : <DataTableShell data={data} columns={columns} searchKey="total_boxes" searchPlaceholder="Search..." />}
    </div>
  );
}
