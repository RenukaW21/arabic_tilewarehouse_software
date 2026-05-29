import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productionOrderApi, type CostSummaryRow, type CostSummaryTotals, type ProductionStatus } from '@/api/productionApi';
import { warehouseApi } from '@/api/warehouseApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Hammer, Cpu, AlertTriangle, Package, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const STATUS_VARIANT: Record<ProductionStatus, string> = {
  draft: 'secondary', in_progress: 'warning', completed: 'success', cancelled: 'destructive',
};

// ─── summary card ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon: Icon, className = '' }: {
  label: string; value: string; icon: React.ElementType; className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ProductionCostsPage() {
  const { t } = useTranslation();

  const [page,         setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');

  const listParams: Record<string, any> = {
    page, limit: 25, sortOrder: 'DESC',
    ...(statusFilter    !== 'all' ? { status:       statusFilter }    : {}),
    ...(warehouseFilter !== 'all' ? { warehouse_id: warehouseFilter } : {}),
  };

  // Lookups
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses', { limit: 500 }],
    queryFn: () => warehouseApi.getAll({ limit: 500 }),
  });
  const warehouseOptions = warehousesData?.data?.map((w: any) => ({ value: w.id, label: w.name })) ?? [];

  // Data
  const { data, isLoading } = useQuery({
    queryKey: ['production-cost-summary', listParams],
    queryFn: () => productionOrderApi.getCostSummary(listParams),
  });

  const rows: CostSummaryRow[]   = data?.data    ?? [];
  const meta                     = data?.meta     ?? null;
  const summary: CostSummaryTotals = data?.summary ?? {
    total_labor: 0, total_machine: 0, total_wastage: 0, total_material: 0, grand_total: 0,
  };

  // Table columns
  const columns = [
    {
      key: 'order_number',
      label: t('production.costs.orderNumber'),
      render: (r: CostSummaryRow) => (
        <span className="font-mono text-sm font-medium">{r.order_number}</span>
      ),
    },
    {
      key: 'status',
      label: t('production.costs.status'),
      render: (r: CostSummaryRow) => (
        <Badge variant={STATUS_VARIANT[r.status] as any} className="text-xs capitalize">
          {r.status?.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'warehouse_name',
      label: t('production.costs.warehouse'),
      render: (r: CostSummaryRow) => r.warehouse_name ?? '—',
    },
    {
      key: 'planned_date',
      label: t('production.costs.plannedDate'),
      render: (r: CostSummaryRow) => r.planned_date?.slice(0, 10) ?? '—',
    },
    {
      key: 'material_cost',
      label: t('production.costs.materialCost'),
      render: (r: CostSummaryRow) => (
        <span className="text-blue-700">{fmt(r.total_material_cost)}</span>
      ),
    },
    {
      key: 'labor_cost',
      label: t('production.costs.laborCost'),
      render: (r: CostSummaryRow) => fmt(r.labor_cost),
    },
    {
      key: 'machine_cost',
      label: t('production.costs.machineCost'),
      render: (r: CostSummaryRow) => fmt(r.machine_cost),
    },
    {
      key: 'wastage_cost',
      label: t('production.costs.wastageCost'),
      render: (r: CostSummaryRow) => (
        <span className={Number(r.wastage_cost) > 0 ? 'text-orange-600' : ''}>
          {fmt(r.wastage_cost)}
        </span>
      ),
    },
    {
      key: 'total_cost',
      label: t('production.costs.totalCost'),
      render: (r: CostSummaryRow) => (
        <span className="font-bold text-foreground">{fmt(r.total_cost)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('production.costs.title')}
        subtitle={t('production.costs.subtitle')}
      />

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 px-6">
        <SummaryCard label={t('production.costs.totalMaterial')} value={fmt(summary.total_material)} icon={Package} />
        <SummaryCard label={t('production.costs.totalLabor')}    value={fmt(summary.total_labor)}   icon={Hammer} />
        <SummaryCard label={t('production.costs.totalMachine')}  value={fmt(summary.total_machine)} icon={Cpu} />
        <SummaryCard label={t('production.costs.totalWastage')}  value={fmt(summary.total_wastage)} icon={AlertTriangle} className="border-orange-200" />
        <SummaryCard label={t('production.costs.grandTotal')}    value={fmt(summary.grand_total)}   icon={DollarSign}    className="border-primary/30 bg-primary/5" />
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-8 text-sm">
            <SelectValue placeholder={t('production.costs.filterStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={warehouseFilter} onValueChange={(v) => { setWarehouseFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] h-8 text-sm">
            <SelectValue placeholder={t('production.costs.filterWarehouse')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('production.costs.allWarehouses')}</SelectItem>
            {warehouseOptions.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <DataTableShell
        data={rows}
        columns={columns}
        searchKey="search"
        serverSide
        paginationMeta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
