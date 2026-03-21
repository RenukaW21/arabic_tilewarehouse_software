import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockAdjustmentsApi, type StockAdjustment, type CreateStockAdjustmentPayload } from '@/api/stockAdjustmentsApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CrudFormDialog, FieldDef } from '@/components/shared/CrudFormDialog';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function StockAdjustmentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockAdjustment | null>(null);
  const [deleting, setDeleting] = useState<StockAdjustment | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const listParams = { page, limit: 25, search: search.trim() || undefined, sortBy: 'created_at', sortOrder: 'DESC' as const };

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses', { limit: 500 }],
    queryFn: () => warehouseApi.getAll({ limit: 500 }),
  });
  const { data: productsData } = useQuery({
    queryKey: ['products', { limit: 500 }],
    queryFn: () => productApi.getAll({ page: 1, limit: 500 }),
  });

  const warehouses = warehousesData?.data ?? [];
  const products = productsData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['stock-adjustments', listParams],
    queryFn: () => stockAdjustmentsApi.getAll(listParams),
  });

  const rows: StockAdjustment[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    applySearch(value);
  }, [applySearch]);

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));

  const fields: FieldDef[] = [
    { key: 'warehouse_id', label: t('stockAdjustmentsPage.warehouse'), type: 'select', required: true, options: warehouseOptions },
    { key: 'product_id', label: t('stockAdjustmentsPage.product'), type: 'select', required: true, options: productOptions },
    { key: 'adjustment_type', label: t('stockAdjustmentsPage.type'), type: 'select', required: true, options: [{ value: 'add', label: t('stockAdjustmentsPage.typeAdd') }, { value: 'deduct', label: t('stockAdjustmentsPage.typeDeduct') }], defaultValue: 'add' },
    { key: 'boxes', label: t('stockAdjustmentsPage.boxes'), type: 'number', defaultValue: 0, required: true },
    { key: 'pieces', label: t('common.pieces', 'قطع'), type: 'number', defaultValue: 0 },
    { key: 'reason', label: t('stockAdjustmentsPage.reason'), type: 'text', required: true },
  ];

  const saveMutation = useMutation({
    mutationFn: async (fd: Record<string, unknown>) => {
      const payload: CreateStockAdjustmentPayload = {
        warehouse_id: String(fd.warehouse_id),
        product_id: String(fd.product_id),
        adjustment_type: fd.adjustment_type as 'add' | 'deduct',
        boxes: Number(fd.boxes) || 0,
        pieces: Number(fd.pieces) || 0,
        reason: String(fd.reason),
      };
      if (editing) return stockAdjustmentsApi.update(editing.id, payload);
      return stockAdjustmentsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? t('stockAdjustmentsPage.updated') : t('stockAdjustmentsPage.created'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? t('common.operationFailed', 'فشلت العملية'));
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => stockAdjustmentsApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
      toast.success(t('stockAdjustmentsPage.approved'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? t('common.approveFailed', 'فشل الاعتماد'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => stockAdjustmentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
      setDeleting(null);
      toast.success(t('stockAdjustmentsPage.deleted'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? t('common.deleteFailed', 'فشل الحذف'));
    },
  });

  const columns = [
    { key: 'product', label: t('stockAdjustmentsPage.product'), render: (r: StockAdjustment) => `${r.product_code ?? ''} — ${r.product_name ?? r.product_id}` },
    { key: 'warehouse_name', label: t('stockAdjustmentsPage.warehouse'), render: (r: StockAdjustment) => r.warehouse_name ?? '—' },
    { key: 'adjustment_type', label: t('stockAdjustmentsPage.type'), render: (r: StockAdjustment) => <StatusBadge status={r.adjustment_type === 'add' ? 'active' : 'cancelled'} /> },
    { key: 'boxes', label: t('stockAdjustmentsPage.boxes'), render: (r: StockAdjustment) => r.boxes },
    { key: 'reason', label: t('stockAdjustmentsPage.reason'), render: (r: StockAdjustment) => r.reason },
    { key: 'status', label: t('stockAdjustmentsPage.status'), render: (r: StockAdjustment) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: t('stockAdjustmentsPage.actions'),
      render: (r: StockAdjustment) => (
        <div className="flex gap-1">
          {r.status === 'pending' && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialogOpen(true); }} title={t('common.edit', 'تعديل')}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending} title={t('common.approve', 'اعتماد')}><CheckCircle className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)} title={t('common.delete', 'حذف')}><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('stockAdjustmentsPage.title')} subtitle={t('stockAdjustmentsPage.subtitle')} onAdd={() => { setEditing(null); setDialogOpen(true); }} addLabel={t('stockAdjustmentsPage.newAdjustment')} />
      <DataTableShell<StockAdjustment>
        data={rows}
        columns={columns}
        searchKey="reason"
        searchPlaceholder={t('stockAdjustmentsPage.searchPlaceholder')}
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />
      <CrudFormDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); }} onSubmit={(d) => saveMutation.mutateAsync(d)} fields={fields} title={editing ? t('stockAdjustmentsPage.editAdjustment') : t('stockAdjustmentsPage.newAdjustment')} initialData={editing} loading={saveMutation.isPending} />
      <DeleteConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id)} loading={deleteMutation.isPending} />
    </div>
  );
}
