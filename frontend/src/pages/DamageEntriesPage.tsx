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

export default function DamageEntriesPage() {
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
    { key: 'warehouse_id', label: 'Warehouse', type: 'select', required: true, options: warehouseOptions },
    { key: 'product_id', label: 'Product', type: 'select', required: true, options: productOptions },
    { key: 'damage_date', label: 'Damage Date', type: 'date' },
    { key: 'damaged_boxes', label: 'Damaged Boxes', type: 'number', defaultValue: 0 },
    { key: 'damaged_pieces', label: 'Damaged Pieces', type: 'number', defaultValue: 0 },
    { key: 'damage_reason', label: 'Reason', type: 'text' },
    { key: 'estimated_loss', label: 'Estimated Loss (₹)', type: 'number' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['damage-entries'] }); setDialogOpen(false); setEditing(null); toast.success(editing ? 'Updated' : 'Damage entry created. Stock reduced.'); },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => toast.error(e?.response?.data?.error?.message ?? 'Operation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => damageEntriesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['damage-entries'] }); setDeleting(null); toast.success('Deleted'); },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => toast.error(e?.response?.data?.error?.message ?? 'Delete failed'),
  });

  const columns = [
    { key: 'product', label: 'Product', render: (r: DamageEntry) => `${r.product_code ?? ''} — ${r.product_name ?? r.product_id}` },
    { key: 'warehouse_name', label: 'Warehouse', render: (r: DamageEntry) => r.warehouse_name ?? '—' },
    { key: 'damaged_boxes', label: 'Boxes', render: (r: DamageEntry) => r.damaged_boxes },
    { key: 'damage_reason', label: 'Reason', render: (r: DamageEntry) => r.damage_reason ?? '—' },
    { key: 'estimated_loss', label: 'Loss', render: (r: DamageEntry) => r.estimated_loss != null ? `₹${Number(r.estimated_loss).toLocaleString()}` : '—' },
    { key: 'damage_date', label: 'Date', render: (r: DamageEntry) => r.damage_date ? new Date(r.damage_date).toLocaleDateString() : '—' },
    { key: 'actions', label: 'Actions', render: (r: DamageEntry) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Damage Entries" subtitle="Record damaged stock. Creating an entry reduces stock." onAdd={() => { setEditing(null); setDialogOpen(true); }} addLabel="New Entry" />
      <DataTableShell<DamageEntry>
        data={rows}
        columns={columns}
        searchKey="damage_reason"
        searchPlaceholder="Search..."
        serverSide
        searchValue={searchInput}
        onSearchChange={(v) => { setSearchInput(v); applySearch(v); }}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />
      <CrudFormDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); }} onSubmit={(d) => saveMutation.mutateAsync(d)} fields={fields} title={editing ? 'Edit Damage Entry' : 'New Damage Entry'} initialData={editing} loading={saveMutation.isPending} />
      <DeleteConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id)} loading={deleteMutation.isPending} />
    </div>
  );
}
