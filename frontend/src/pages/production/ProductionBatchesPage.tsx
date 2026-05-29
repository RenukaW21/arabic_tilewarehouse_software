import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productionBatchApi, productionOrderApi, type ProductionBatch, type BatchStatus } from '@/api/productionApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Pencil, Trash2, PlayCircle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<BatchStatus, string> = {
  pending:     'secondary',
  in_progress: 'warning',
  completed:   'success',
  rejected:    'destructive',
};

const STATUS_LABEL: Record<BatchStatus, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  completed:   'Completed',
  rejected:    'Rejected',
};

// ─── Complete dialog ───────────────────────────────────────────────────────────

function CompleteDialog({
  batch, onClose,
}: { batch: ProductionBatch; onClose: () => void }) {
  const qc = useQueryClient();
  const [qtyProduced, setQtyProduced] = useState(Number(batch.quantity_planned) || 0);
  const [wastage,     setWastage]     = useState(0);

  const mut = useMutation({
    mutationFn: () =>
      productionBatchApi.updateStatus(batch.id, 'completed', {
        quantity_produced: qtyProduced,
        wastage_qty:       wastage,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-batches'] });
      toast.success('Batch completed');
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Failed'),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Complete Batch — {batch.batch_number}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Quantity Produced</Label>
            <Input type="number" min={0} value={qtyProduced}
              onChange={(e) => setQtyProduced(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Wastage Qty</Label>
            <Input type="number" min={0} value={wastage}
              onChange={(e) => setWastage(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Complete Batch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

interface FormState {
  warehouse_id: string;
  production_order_id: string;
  product_id: string;
  quantity_planned: number;
  start_date: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  warehouse_id: '', production_order_id: '', product_id: '',
  quantity_planned: 0, start_date: '', notes: '',
});

export default function ProductionBatchesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [completeFor,  setCompleteFor]  = useState<ProductionBatch | null>(null);
  const [editing,      setEditing]      = useState<ProductionBatch | null>(null);
  const [form,         setForm]         = useState<FormState>(emptyForm());
  const [page,         setPage]         = useState(1);
  const [searchInput,  setSearchInput]  = useState('');
  const [search,       setSearch]       = useState('');

  const handleSearchChange = useCallback((val: string) => { setSearchInput(val); setSearch(val); setPage(1); }, []);

  const listParams = { page, limit: 25, search: search.trim() || undefined, sortBy: 'created_at' as const, sortOrder: 'DESC' as const };

  // ─ Lookups ─
  const { data: warehousesData } = useQuery({ queryKey: ['warehouses', { limit: 500 }],     queryFn: () => warehouseApi.getAll({ limit: 500 }) });
  const { data: productsData }   = useQuery({ queryKey: ['products',   { limit: 1000 }],    queryFn: () => productApi.getAll({ limit: 1000 }) });
  const { data: ordersData }     = useQuery({ queryKey: ['production-orders', { limit: 500 }], queryFn: () => productionOrderApi.getAll({ limit: 500 }) });

  const warehouseOptions = warehousesData?.data?.map((w: any) => ({ value: w.id, label: w.name })) ?? [];
  const productOptions   = productsData?.data?.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })) ?? [];
  const orderOptions     = ordersData?.data?.map((o: any) => ({ value: o.id, label: o.order_number })) ?? [];

  // ─ List ─
  const { data, isLoading } = useQuery({
    queryKey: ['production-batches', listParams],
    queryFn: () => productionBatchApi.getAll(listParams),
  });
  const batches: ProductionBatch[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  // ─ Dialog helpers ─
  const openCreate = () => { setEditing(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit   = (b: ProductionBatch) => {
    setEditing(b);
    setForm({
      warehouse_id:        b.warehouse_id,
      production_order_id: b.production_order_id ?? '',
      product_id:          b.product_id ?? '',
      quantity_planned:    Number(b.quantity_planned) || 0,
      start_date:          b.start_date?.slice(0, 10) ?? '',
      notes:               b.notes ?? '',
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const set = (field: keyof FormState) => (val: string | number) =>
    setForm((f) => ({ ...f, [field]: val }));

  // ─ Mutations ─
  const invalidate = () => qc.invalidateQueries({ queryKey: ['production-batches'] });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        warehouse_id:        form.warehouse_id,
        production_order_id: form.production_order_id || null,
        product_id:          form.product_id || null,
        quantity_planned:    form.quantity_planned,
        start_date:          form.start_date || null,
        notes:               form.notes || undefined,
      };
      if (editing) return productionBatchApi.update(editing.id, payload);
      return productionBatchApi.create(payload);
    },
    onSuccess: () => { invalidate(); closeDialog(); toast.success(editing ? 'Batch updated' : 'Batch created'); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Operation failed'),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BatchStatus }) =>
      productionBatchApi.updateStatus(id, status),
    onSuccess: () => { invalidate(); toast.success('Status updated'); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => productionBatchApi.delete(id),
    onSuccess: () => { invalidate(); toast.success('Batch deleted'); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Failed'),
  });

  // ─ Table ─
  const columns = [
    {
      key: 'batch_number', label: t('production.batches.batchNumber'),
      render: (r: ProductionBatch) => <span className="font-mono text-sm font-medium">{r.batch_number}</span>,
    },
    {
      key: 'status', label: t('production.batches.status'),
      render: (r: ProductionBatch) => (
        <Badge variant={STATUS_VARIANT[r.status] as any} className="capitalize text-xs">
          {STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
    { key: 'warehouse_name', label: t('production.batches.warehouse'), render: (r: ProductionBatch) => r.warehouse_name ?? '—' },
    {
      key: 'product', label: t('production.batches.product'),
      render: (r: ProductionBatch) => r.product_name
        ? <span className="text-sm">{r.product_code} — {r.product_name}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: 'production_order', label: t('production.batches.productionOrder'),
      render: (r: ProductionBatch) => r.production_order_number
        ? <span className="font-mono text-xs">{r.production_order_number}</span>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: 'qty', label: t('production.batches.quantity'),
      render: (r: ProductionBatch) => (
        <div className="text-xs">
          <span>Planned: <strong>{Number(r.quantity_planned)}</strong></span>
          {r.status !== 'pending' && <span className="ml-2">Produced: <strong>{Number(r.quantity_produced)}</strong></span>}
          {Number(r.wastage_qty) > 0 && <span className="ml-2 text-orange-600">Wastage: {Number(r.wastage_qty)}</span>}
        </div>
      ),
    },
    {
      key: 'dates', label: t('production.batches.dates'),
      render: (r: ProductionBatch) => (
        <div className="text-xs text-muted-foreground">
          {r.start_date ? <div>Start: {r.start_date.slice(0, 10)}</div> : null}
          {r.end_date   ? <div>End: {r.end_date.slice(0, 10)}</div>   : null}
        </div>
      ),
    },
    {
      key: 'actions', label: t('common.actions'),
      render: (r: ProductionBatch) => (
        <div className="flex items-center gap-1 flex-wrap">
          {r.status === 'pending' && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-blue-600 border-blue-200"
              onClick={() => statusMut.mutate({ id: r.id, status: 'in_progress' })} disabled={statusMut.isPending}>
              <PlayCircle className="h-3 w-3" /> Start
            </Button>
          )}
          {r.status === 'in_progress' && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-green-600 border-green-200"
              onClick={() => setCompleteFor(r)}>
              <CheckCircle className="h-3 w-3" /> Complete
            </Button>
          )}
          {(r.status === 'pending' || r.status === 'in_progress') && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-orange-600 border-orange-200"
              onClick={() => statusMut.mutate({ id: r.id, status: 'rejected' })} disabled={statusMut.isPending}>
              <XCircle className="h-3 w-3" /> Reject
            </Button>
          )}
          {(r.status === 'pending' || r.status === 'in_progress') && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {r.status === 'pending' && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
              onClick={() => { if (confirm(t('production.batches.confirmDelete'))) deleteMut.mutate(r.id); }}
              disabled={deleteMut.isPending}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('production.batches.title')}
        subtitle={t('production.batches.subtitle')}
        onAdd={openCreate}
        addLabel={t('production.batches.new')}
      />

      <DataTableShell
        data={batches}
        columns={columns}
        searchKey="search"
        searchPlaceholder={t('production.batches.search')}
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {/* Complete dialog */}
      {completeFor && <CompleteDialog batch={completeFor} onClose={() => setCompleteFor(null)} />}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t('production.batches.edit') : t('production.batches.new')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('production.batches.warehouse')} *</Label>
                <Select value={form.warehouse_id} onValueChange={set('warehouse_id')}>
                  <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('production.batches.quantityPlanned')} *</Label>
                <Input type="number" min={0} value={form.quantity_planned}
                  onChange={(e) => set('quantity_planned')(Number(e.target.value))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('production.batches.productionOrder')}</Label>
                <Select value={form.production_order_id || '__none__'}
                  onValueChange={(v) => set('production_order_id')(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="None (standalone batch)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {orderOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('production.batches.product')}</Label>
                <Select value={form.product_id || '__none__'}
                  onValueChange={(v) => set('product_id')(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {productOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('production.batches.startDate')}</Label>
              <Input type="date" value={form.start_date}
                onChange={(e) => set('start_date')(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>{t('production.batches.notes')}</Label>
              <Textarea rows={2} value={form.notes}
                onChange={(e) => set('notes')(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !form.warehouse_id || !form.quantity_planned}
            >
              {saveMut.isPending ? t('app.loading') : editing ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
