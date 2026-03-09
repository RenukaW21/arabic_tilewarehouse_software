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

export default function StockAdjustmentsPage() {
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
    { key: 'warehouse_id', label: 'Warehouse', type: 'select', required: true, options: warehouseOptions },
    { key: 'product_id', label: 'Product', type: 'select', required: true, options: productOptions },
    { key: 'adjustment_type', label: 'Type', type: 'select', required: true, options: [{ value: 'add', label: 'Add' }, { value: 'deduct', label: 'Deduct' }], defaultValue: 'add' },
    { key: 'boxes', label: 'Boxes', type: 'number', defaultValue: 0, required: true },
    { key: 'pieces', label: 'Pieces', type: 'number', defaultValue: 0 },
    { key: 'reason', label: 'Reason', type: 'text', required: true },
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
      toast.success(editing ? 'Updated' : 'Adjustment created. Approve to apply to stock.');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? 'Operation failed');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => stockAdjustmentsApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
      toast.success('Adjustment approved. Stock updated.');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? 'Approve failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => stockAdjustmentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
      setDeleting(null);
      toast.success('Deleted');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed');
    },
  });

  const columns = [
    { key: 'product', label: 'Product', render: (r: StockAdjustment) => `${r.product_code ?? ''} — ${r.product_name ?? r.product_id}` },
    { key: 'warehouse_name', label: 'Warehouse', render: (r: StockAdjustment) => r.warehouse_name ?? '—' },
    { key: 'adjustment_type', label: 'Type', render: (r: StockAdjustment) => <StatusBadge status={r.adjustment_type === 'add' ? 'active' : 'cancelled'} /> },
    { key: 'boxes', label: 'Boxes', render: (r: StockAdjustment) => r.boxes },
    { key: 'reason', label: 'Reason', render: (r: StockAdjustment) => r.reason },
    { key: 'status', label: 'Status', render: (r: StockAdjustment) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: StockAdjustment) => (
        <div className="flex gap-1">
          {r.status === 'pending' && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialogOpen(true); }} title="Edit"><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending} title="Approve"><CheckCircle className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Stock Adjustments" subtitle="Create adjustments and approve to update stock." onAdd={() => { setEditing(null); setDialogOpen(true); }} addLabel="New Adjustment" />
      <DataTableShell<StockAdjustment>
        data={rows}
        columns={columns}
        searchKey="reason"
        searchPlaceholder="Search..."
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />
      <CrudFormDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); }} onSubmit={(d) => saveMutation.mutateAsync(d)} fields={fields} title={editing ? 'Edit Adjustment' : 'New Adjustment'} initialData={editing} loading={saveMutation.isPending} />
      <DeleteConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id)} loading={deleteMutation.isPending} />
    </div>
  );
}
