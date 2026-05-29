import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productionOrderApi, type MaterialRecord, type ProductionStatus } from '@/api/productionApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

const STATUS_VARIANT: Record<ProductionStatus, string> = {
  draft: 'secondary', in_progress: 'warning', completed: 'success', cancelled: 'destructive',
};

export default function ProductionMaterialsPage() {
  const { t } = useTranslation();

  const [page, setPage]               = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');

  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val); setSearch(val); setPage(1);
  }, []);

  const listParams = {
    page, limit: 25,
    search: search.trim() || undefined,
    sortOrder: 'DESC' as const,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['production-materials', listParams],
    queryFn: () => productionOrderApi.getAllMaterials(listParams),
  });

  const records: MaterialRecord[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const columns = [
    {
      key: 'order_number',
      label: t('production.materials.orderNumber'),
      render: (r: MaterialRecord) => (
        <span className="font-mono text-sm font-medium">{r.order_number}</span>
      ),
    },
    {
      key: 'order_status',
      label: t('production.materials.orderStatus'),
      render: (r: MaterialRecord) => (
        <Badge variant={STATUS_VARIANT[r.order_status] as any} className="text-xs capitalize">
          {r.order_status?.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'warehouse_name',
      label: t('production.materials.warehouse'),
      render: (r: MaterialRecord) => r.warehouse_name ?? '—',
    },
    {
      key: 'product',
      label: t('production.materials.rawMaterial'),
      render: (r: MaterialRecord) => (
        <div>
          <p className="text-sm font-medium">{r.product_name}</p>
          <p className="text-xs text-muted-foreground">{r.product_code}</p>
        </div>
      ),
    },
    {
      key: 'planned_qty',
      label: t('production.materials.plannedQty'),
      render: (r: MaterialRecord) => (
        <span className="font-medium">{Number(r.planned_qty).toLocaleString()}</span>
      ),
    },
    {
      key: 'actual_qty',
      label: t('production.materials.actualQty'),
      render: (r: MaterialRecord) => {
        const planned = Number(r.planned_qty);
        const actual  = Number(r.actual_qty);
        const diff    = actual - planned;
        return (
          <div>
            <span className="font-medium">{actual.toLocaleString()}</span>
            {diff !== 0 && (
              <span className={`ml-1 text-xs ${diff > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                ({diff > 0 ? '+' : ''}{diff})
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'unit_cost',
      label: t('production.materials.unitCost'),
      render: (r: MaterialRecord) => `₹${Number(r.unit_cost).toFixed(2)}`,
    },
    {
      key: 'line_total',
      label: t('production.materials.lineTotal'),
      render: (r: MaterialRecord) => (
        <span className="font-medium">
          ₹{Number(r.line_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('production.materials.title')}
        subtitle={t('production.materials.subtitle')}
      />

      <DataTableShell
        data={records}
        columns={columns}
        searchKey="search"
        searchPlaceholder={t('production.materials.search')}
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
