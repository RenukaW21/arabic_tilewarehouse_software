import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { damageEntriesApi, type DamageEntry, type CreateDamageEntryPayload } from '@/api/damageEntriesApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { CrudFormDialog, FieldDef } from '@/components/shared/CrudFormDialog';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function DamageEntriesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DamageEntry | null>(null);
  const [deleting, setDeleting] = useState<DamageEntry | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const applySearch = useCallback((value: string) => { setSearch(value); setPage(1); }, []);

  const listParams = { page, limit: 25, search: search.trim() || undefined, sortBy: 'created_at', sortOrder: 'DESC' as const };
  const { data: warehousesData } = useQuery({ queryKey: ['warehouses', { limit: 500 }], queryFn: () => warehouseApi.getAll({ limit: 500 }) });
  const { data: productsData } = useQuery({ queryKey: ['products', { limit: 500 }], queryFn: () => productApi.getAll({ page: 1, limit: 500 }) });
  const warehouses = warehousesData?.data ?? [];
  const products = productsData?.data ?? [];

  const { data, isLoading } = useQuery({ queryKey: ['damage-entries', listParams], queryFn: () => damageEntriesApi.getAll(listParams) });
  const rows: DamageEntry[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
  const fields: FieldDef[] = [
    { key: 'warehouse_id', label: t('damageEntriesPage.warehouse'), type: 'select', required: true, options: warehouseOptions },
    { key: 'product_id', label: t('damageEntriesPage.product'), type: 'select', required: true, options: productOptions },
    { key: 'damage_date', label: t('damageEntriesPage.damageDate'), type: 'date' },
    { key: 'damaged_boxes', label: t('damageEntriesPage.damagedBoxes'), type: 'number', defaultValue: 0 },
    { key: 'damaged_pieces', label: t('damageEntriesPage.damagedPieces'), type: 'number', defaultValue: 0 },
    { key: 'damage_reason', label: t('damageEntriesPage.damageReason'), type: 'text' },
    { key: 'estimated_loss', label: t('damageEntriesPage.estimatedLoss'), type: 'number' },
    { key: 'notes', label: t('damageEntriesPage.notes'), type: 'textarea' },
  ];

  const saveMutation = useMutation({
    mutationFn: async (fd: Record<string, unknown>) => {
      const payload: CreateDamageEntryPayload = {
        warehouse_id: String(fd.warehouse_id),
        product_id: String(fd.product_id),
        damage_date: fd.damage_date ? String(fd.damage_date).slice(0, 10) : undefined,
        damaged_boxes: Number(fd.damaged_boxes) || 0,
        damaged_pieces: Number(fd.damaged_pieces) || 0,
        damage_reason: fd.damage_reason ? String(fd.damage_reason) : null,
        estimated_loss: fd.estimated_loss != null ? Number(fd.estimated_loss) : null,
        notes: fd.notes ? String(fd.notes) : null,
      };
      if (editing) return damageEntriesApi.update(editing.id, payload);
      return damageEntriesApi.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['damage-entries'] }); setDialogOpen(false); setEditing(null); toast.success(editing ? t('damageEntriesPage.updated') : t('damageEntriesPage.created')); },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => toast.error(e?.response?.data?.error?.message ?? t('common.operationFailed', 'فشلت العملية')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => damageEntriesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['damage-entries'] }); setDeleting(null); toast.success(t('damageEntriesPage.deleted')); },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => toast.error(e?.response?.data?.error?.message ?? t('common.deleteFailed', 'فشل الحذف')),
  });

  const columns = [
    { key: 'product', label: t('damageEntriesPage.product'), render: (r: DamageEntry) => `${r.product_code ?? ''} — ${r.product_name ?? r.product_id}` },
    { key: 'warehouse_name', label: t('damageEntriesPage.warehouse'), render: (r: DamageEntry) => r.warehouse_name ?? '—' },
    { key: 'damaged_boxes', label: t('damageEntriesPage.boxes'), render: (r: DamageEntry) => r.damaged_boxes },
    { key: 'damage_reason', label: t('damageEntriesPage.reason'), render: (r: DamageEntry) => r.damage_reason ?? '—' },
    { key: 'estimated_loss', label: t('damageEntriesPage.loss'), render: (r: DamageEntry) => r.estimated_loss != null ? `₹${Number(r.estimated_loss).toLocaleString()}` : '—' },
    { key: 'damage_date', label: t('damageEntriesPage.date'), render: (r: DamageEntry) => r.damage_date ? new Date(r.damage_date).toLocaleDateString() : '—' },
    { key: 'actions', label: t('damageEntriesPage.actions'), render: (r: DamageEntry) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title={t('damageEntriesPage.title')} subtitle={t('damageEntriesPage.subtitle')} onAdd={() => { setEditing(null); setDialogOpen(true); }} addLabel={t('damageEntriesPage.newEntry')} />
      <DataTableShell<DamageEntry>
        data={rows}
        columns={columns}
        searchKey="damage_reason"
        searchPlaceholder={t('damageEntriesPage.searchPlaceholder')}
        serverSide
        searchValue={searchInput}
        onSearchChange={(v) => { setSearchInput(v); applySearch(v); }}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />
      <CrudFormDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); }} onSubmit={(d) => saveMutation.mutateAsync(d)} fields={fields} title={editing ? t('damageEntriesPage.editEntry') : t('damageEntriesPage.newEntry')} initialData={editing} loading={saveMutation.isPending} />
      <DeleteConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id)} loading={deleteMutation.isPending} />
    </div>
  );
}
