import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockCountsApi, type StockCount, type StockCountItem, type CreateStockCountPayload } from '@/api/stockCountsApi';
import { warehouseApi } from '@/api/warehouseApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useTranslation } from 'react-i18next';

export default function StockCountsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [countType, setCountType] = useState<'full' | 'cycle' | 'spot'>('full');

  const listParams = { page, limit: 25, search: search.trim() || undefined, sortBy: 'created_at', sortOrder: 'DESC' as const };

  const { data: warehousesData } = useQuery({ queryKey: ['warehouses', { limit: 500 }], queryFn: () => warehouseApi.getAll({ limit: 500 }) });
  const warehouses = warehousesData?.data ?? [];

  const { data, isLoading } = useQuery({ queryKey: ['stock-counts', listParams], queryFn: () => stockCountsApi.getAll(listParams) });
  const rows: StockCount[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const createMutation = useMutation({
    mutationFn: (payload: CreateStockCountPayload) => stockCountsApi.create(payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['stock-counts'] });
      setCreateOpen(false);
      setWarehouseId('');
      const id = res?.data?.id;
      if (id) navigate(`/inventory/counts/${id}`);
      toast.success(t('stockCounts.created'));
    },
  });

  const handleCreate = () => {
    if (!warehouseId) return;
    createMutation.mutate({ warehouse_id: warehouseId, count_type: countType });
  };

  const columns = [
    { key: 'count_number', label: t('stockCounts.countHash'), render: (r: StockCount) => <span className="font-mono text-sm">{r.count_number}</span> },
    { key: 'warehouse_name', label: t('stockCounts.warehouse'), render: (r: StockCount) => r.warehouse_name ?? r.warehouse_id },
    { key: 'count_type', label: t('stockCounts.type'), render: (r: StockCount) => t(`stockCounts.type${r.count_type.charAt(0).toUpperCase() + r.count_type.slice(1)}`) },
    { key: 'status', label: t('stockCounts.status'), render: (r: StockCount) => <StatusBadge status={r.status} /> },
    { key: 'count_date', label: t('stockCounts.date'), render: (r: StockCount) => r.count_date ? new Date(r.count_date).toLocaleDateString() : '—' },
    {
      key: 'actions',
      label: t('stockCounts.actions'),
      render: (r: StockCount) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/inventory/counts/${r.id}`)}>
          {t('stockCounts.view')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('stockCounts.title')}
        subtitle={t('stockCounts.subtitle')}
        onAdd={() => setCreateOpen(true)}
        addLabel={t('stockCounts.newCount')}
      />
      <DataTableShell<StockCount>
        data={rows}
        columns={columns}
        searchKey="count_number"
        searchPlaceholder={t('stockCounts.searchPlaceholder')}
        serverSide
        searchValue={searchInput}
        onSearchChange={(v) => { setSearchInput(v); setSearch(v); setPage(1); }}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stockCounts.newStockCount')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('stockCounts.warehouse')}</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId} required>
                <SelectTrigger><SelectValue placeholder={t('stockCounts.selectWarehouse')} /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('stockCounts.countType')}</Label>
              <Select value={countType} onValueChange={(v) => setCountType(v as 'full' | 'cycle' | 'spot')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{t('stockCounts.typeFull')}</SelectItem>
                  <SelectItem value="cycle">{t('stockCounts.typeCycle')}</SelectItem>
                  <SelectItem value="spot">{t('stockCounts.typeSpot')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel', 'إلغاء')}</Button>
            <Button onClick={handleCreate} disabled={!warehouseId || createMutation.isPending}>
              {createMutation.isPending ? t('stockCounts.creating') : t('common.create', 'إنشاء')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StockCountDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [updating, setUpdating] = useState<string | null>(null);

  const { data: countData, isLoading } = useQuery({
    queryKey: ['stock-counts', id],
    queryFn: () => stockCountsApi.getById(id!),
    enabled: !!id,
  });

  const loadFromStockMutation = useMutation({
    mutationFn: () => stockCountsApi.loadFromStock(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-counts', id] });
      toast.success(t('stockCounts.loadFromStock'));
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, counted_boxes }: { itemId: string; counted_boxes: number }) => stockCountsApi.updateItem(id!, itemId, counted_boxes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-counts', id] });
      setUpdating(null);
    },
    onError: () => { setUpdating(null); },
  });

  const count = countData?.data;
  const items: StockCountItem[] = count?.items ?? [];

  if (!id) return <div className="p-4">{t('stockCounts.missingId')}</div>;
  if (isLoading || !countData) return <div className="p-4">{t('stockCounts.loading')}</div>;
  if (!count) return <div className="p-4">{t('stockCounts.notFound')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/counts')}>{t('stockCounts.back')}</Button>
      </div>
      <PageHeader title={count.count_number} subtitle={`${count.warehouse_name ?? count.warehouse_id} — ${count.status}`} />
      {count.status === 'draft' && items.length === 0 && (
        <Button onClick={() => loadFromStockMutation.mutate()} disabled={loadFromStockMutation.isPending}>
          {loadFromStockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
          {t('stockCounts.loadFromStock')}
        </Button>
      )}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2 font-medium">{t('stockCounts.product')}</th>
              <th className="text-right px-4 py-2 font-medium">{t('stockCounts.system')}</th>
              <th className="text-right px-4 py-2 font-medium">{t('stockCounts.counted')}</th>
              <th className="text-right px-4 py-2 font-medium">{t('stockCounts.variance')}</th>
              {count.status === 'draft' && <th className="w-32" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t('stockCounts.noItems')}</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="px-4 py-2">{item.product_code} — {item.product_name}</td>
                <td className="px-4 py-2 text-right">{Number(item.system_boxes).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">
                  {count.status === 'draft' ? (
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="h-8 w-24 text-right"
                      defaultValue={item.counted_boxes ?? item.system_boxes ?? ''}
                      onBlur={(e) => {
                        const n = Number(e.target.value) || 0;
                        if (updating === item.id) return;
                        setUpdating(item.id);
                        updateItemMutation.mutate({ itemId: item.id, counted_boxes: n });
                      }}
                      disabled={updating === item.id}
                    />
                  ) : (
                    Number(item.counted_boxes ?? 0).toLocaleString()
                  )}
                </td>
                <td className="px-4 py-2 text-right">{Number(item.variance_boxes).toLocaleString()}</td>
                {count.status === 'draft' && <td />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
