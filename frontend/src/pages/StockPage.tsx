import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { useTranslation } from 'react-i18next';

export default function StockPage() {
  const { t } = useTranslation();
  const { data = [], isLoading } = useQuery({
    queryKey: ['stock_summary'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stock_summary').select('*, products(name, code), warehouses(name)').order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const columns = [
    { key: 'product_code', label: t('stockSummary.code'), render: (r: any) => <span className="font-mono-code text-sm font-medium">{(r as any).products?.code || '—'}</span> },
    { key: 'product_name', label: t('stockSummary.product'), render: (r: any) => (r as any).products?.name || '—' },
    { key: 'warehouse', label: t('stockSummary.warehouse'), render: (r: any) => (r as any).warehouses?.name || '—' },
    { key: 'total_boxes', label: t('stockSummary.boxes'), render: (r: any) => Number(r.total_boxes || 0) },
    { key: 'total_pieces', label: t('stockSummary.pieces'), render: (r: any) => Number(r.total_pieces || 0) },
    { key: 'total_sqft', label: t('stockSummary.totalSqft'), render: (r: any) => Number(r.total_sqft || 0).toLocaleString() },
  ];

  return (
    <div>
      <PageHeader title={t('stockSummary.title')} subtitle={t('stockSummary.subtitle')} />
      {isLoading ? <p className="text-muted-foreground">{t('common.loading')}</p> : <DataTableShell data={data} columns={columns} searchKey="total_boxes" />}
    </div>
  );
}
