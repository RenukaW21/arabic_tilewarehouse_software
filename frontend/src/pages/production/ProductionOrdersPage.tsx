import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productionOrderApi, type ProductionOrder, type ProductionStatus } from '@/api/productionApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
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
import { Pencil, Trash2, Plus, X, PlayCircle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ProductionStatus, string> = {
  draft:       'secondary',
  in_progress: 'warning',
  completed:   'success',
  cancelled:   'destructive',
};

// ─── Item row types ────────────────────────────────────────────────────────────

interface ItemRow { product_id: string; planned_qty: number; actual_qty: number; wastage_qty: number; unit_cost: number; }

const emptyItem = (): ItemRow => ({ product_id: '', planned_qty: 0, actual_qty: 0, wastage_qty: 0, unit_cost: 0 });

// ─── Sub-component: item table ─────────────────────────────────────────────────

function ItemTable({
  label, rows, onChange, productOptions, showWastage = false,
}: {
  label: string;
  rows: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  productOptions: { value: string; label: string }[];
  showWastage?: boolean;
}) {
  const updateRow = (i: number, field: keyof ItemRow, val: string | number) => {
    const updated = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    onChange(updated);
  };
  const addRow = () => onChange([...rows, emptyItem()]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground py-2 text-center border rounded-md">No items yet</p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="grid gap-1 border rounded-md p-2 bg-muted/30">
          <div className="flex gap-1 items-center">
            <Select value={row.product_id} onValueChange={(v) => updateRow(i, 'product_id', v)}>
              <SelectTrigger className="flex-1 h-7 text-xs">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {productOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeRow(i)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <div>
              <Label className="text-[10px] text-muted-foreground">Planned Qty</Label>
              <Input type="number" min={0} value={row.planned_qty} onChange={(e) => updateRow(i, 'planned_qty', Number(e.target.value))} className="h-7 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Actual Qty</Label>
              <Input type="number" min={0} value={row.actual_qty} onChange={(e) => updateRow(i, 'actual_qty', Number(e.target.value))} className="h-7 text-xs" />
            </div>
            {showWastage ? (
              <div>
                <Label className="text-[10px] text-muted-foreground">Wastage Qty</Label>
                <Input type="number" min={0} value={row.wastage_qty} onChange={(e) => updateRow(i, 'wastage_qty', Number(e.target.value))} className="h-7 text-xs" />
              </div>
            ) : (
              <div>
                <Label className="text-[10px] text-muted-foreground">Unit Cost</Label>
                <Input type="number" min={0} step="0.01" value={row.unit_cost} onChange={(e) => updateRow(i, 'unit_cost', Number(e.target.value))} className="h-7 text-xs" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  warehouse_id: string;
  planned_date: string;
  labor_cost: number;
  machine_cost: number;
  wastage_cost: number;
  notes: string;
  materials: ItemRow[];
  outputs: ItemRow[];
}

const emptyForm = (): FormState => ({
  warehouse_id: '', planned_date: new Date().toISOString().slice(0, 10),
  labor_cost: 0, machine_cost: 0, wastage_cost: 0, notes: '',
  materials: [], outputs: [],
});

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ProductionOrdersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<ProductionOrder | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const handleSearchChange = useCallback((val: string) => { setSearchInput(val); setSearch(val); setPage(1); }, []);

  const listParams = { page, limit: 25, search: search.trim() || undefined, sortBy: 'created_at' as const, sortOrder: 'DESC' as const };

  // ─ Lookups ─
  const { data: warehousesData } = useQuery({ queryKey: ['warehouses', { limit: 500 }], queryFn: () => warehouseApi.getAll({ limit: 500 }) });
  const { data: productsData }   = useQuery({ queryKey: ['products', { limit: 1000 }], queryFn: () => productApi.getAll({ limit: 1000 }) });

  const warehouseOptions = warehousesData?.data?.map((w: any) => ({ value: w.id, label: w.name })) ?? [];
  const productOptions   = productsData?.data?.map((p: any) => ({ value: p.id, label: `${p.code} — ${p.name}` })) ?? [];

  // ─ List ─
  const { data, isLoading } = useQuery({
    queryKey: ['production-orders', listParams],
    queryFn: () => productionOrderApi.getAll(listParams),
  });
  const orders: ProductionOrder[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  // ─ Dialog helpers ─
  const openCreate = () => { setEditing(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit   = (order: ProductionOrder) => {
    setEditing(order);
    setForm({
      warehouse_id: order.warehouse_id,
      planned_date: order.planned_date?.slice(0, 10) ?? '',
      labor_cost:   Number(order.labor_cost)   || 0,
      machine_cost: Number(order.machine_cost) || 0,
      wastage_cost: Number(order.wastage_cost) || 0,
      notes:        order.notes ?? '',
      materials: (order.materials ?? []).map((m) => ({
        product_id: m.product_id, planned_qty: Number(m.planned_qty) || 0,
        actual_qty: Number(m.actual_qty) || 0, wastage_qty: 0, unit_cost: Number(m.unit_cost) || 0,
      })),
      outputs: (order.outputs ?? []).map((o) => ({
        product_id: o.product_id, planned_qty: Number(o.planned_qty) || 0,
        actual_qty: Number(o.actual_qty) || 0, wastage_qty: Number(o.wastage_qty) || 0, unit_cost: Number(o.unit_cost) || 0,
      })),
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  // ─ Mutations ─
  const invalidate = () => qc.invalidateQueries({ queryKey: ['production-orders'] });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        warehouse_id: form.warehouse_id,
        planned_date: form.planned_date,
        labor_cost:   form.labor_cost,
        machine_cost: form.machine_cost,
        wastage_cost: form.wastage_cost,
        notes:        form.notes || undefined,
        materials:    form.materials.filter((m) => m.product_id),
        outputs:      form.outputs.filter((o) => o.product_id),
      };
      if (editing) return productionOrderApi.update(editing.id, payload);
      return productionOrderApi.create(payload);
    },
    onSuccess: () => {
      invalidate();
      closeDialog();
      toast.success(editing ? 'Production order updated' : 'Production order created');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Operation failed'),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProductionStatus }) =>
      productionOrderApi.updateStatus(id, status),
    onSuccess: () => { invalidate(); toast.success('Status updated'); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => productionOrderApi.delete(id),
    onSuccess: () => { invalidate(); toast.success('Production order deleted'); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? 'Failed'),
  });

  // ─ Table columns ─
  const columns = [
    { key: 'order_number', label: 'Order #', render: (r: ProductionOrder) => <span className="font-mono text-sm font-medium">{r.order_number}</span> },
    {
      key: 'status', label: 'Status', render: (r: ProductionOrder) => (
        <Badge variant={STATUS_COLORS[r.status] as any} className="capitalize text-xs">
          {r.status.replace('_', ' ')}
        </Badge>
      ),
    },
    { key: 'warehouse_name', label: 'Warehouse', render: (r: ProductionOrder) => r.warehouse_name ?? '—' },
    { key: 'planned_date',   label: 'Planned Date', render: (r: ProductionOrder) => r.planned_date?.slice(0, 10) ?? '—' },
    {
      key: 'items', label: 'Materials / Outputs', render: (r: ProductionOrder) => (
        <span className="text-xs text-muted-foreground">{r.material_count ?? 0} materials · {r.output_count ?? 0} outputs</span>
      ),
    },
    {
      key: 'total_cost', label: 'Total Cost', render: (r: ProductionOrder) => (
        <span className="font-medium">₹{Number(r.total_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
      ),
    },
    {
      key: 'actions', label: 'Actions', render: (r: ProductionOrder) => (
        <div className="flex items-center gap-1 flex-wrap">
          {r.status === 'draft' && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-blue-600 border-blue-200"
              onClick={() => statusMut.mutate({ id: r.id, status: 'in_progress' })} disabled={statusMut.isPending}>
              <PlayCircle className="h-3 w-3" /> Start
            </Button>
          )}
          {r.status === 'in_progress' && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-green-600 border-green-200"
              onClick={() => statusMut.mutate({ id: r.id, status: 'completed' })} disabled={statusMut.isPending}>
              <CheckCircle className="h-3 w-3" /> Complete
            </Button>
          )}
          {(r.status === 'draft' || r.status === 'in_progress') && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-orange-600 border-orange-200"
              onClick={() => statusMut.mutate({ id: r.id, status: 'cancelled' })} disabled={statusMut.isPending}>
              <XCircle className="h-3 w-3" /> Cancel
            </Button>
          )}
          {(r.status === 'draft' || r.status === 'in_progress') && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {r.status === 'draft' && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
              onClick={() => setDeletingOrder(r)}
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
        title={t('production.orders.title')}
        subtitle={t('production.orders.subtitle')}
        onAdd={openCreate}
        addLabel={t('production.orders.new')}
      />

      <DataTableShell
        data={orders}
        columns={columns}
        searchKey="search"
        searchPlaceholder={t('production.orders.search')}
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {/* ─── Delete Confirm Dialog ────────────────────────────────────────── */}
      <DeleteConfirmDialog
        open={!!deletingOrder}
        onClose={() => setDeletingOrder(null)}
        onConfirm={() => { if (deletingOrder) deleteMut.mutate(deletingOrder.id); setDeletingOrder(null); }}
        loading={deleteMut.isPending}
      />

      {/* ─── Create / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('production.orders.edit') : t('production.orders.new')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ── Header fields ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('production.orders.warehouse')} *</Label>
                <Select value={form.warehouse_id} onValueChange={(v) => setForm((f) => ({ ...f, warehouse_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('production.orders.plannedDate')} *</Label>
                <Input type="date" value={form.planned_date} onChange={(e) => setForm((f) => ({ ...f, planned_date: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t('production.orders.laborCost')}</Label>
                <Input type="number" min={0} step="0.01" value={form.labor_cost}
                  onChange={(e) => setForm((f) => ({ ...f, labor_cost: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('production.orders.machineCost')}</Label>
                <Input type="number" min={0} step="0.01" value={form.machine_cost}
                  onChange={(e) => setForm((f) => ({ ...f, machine_cost: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('production.orders.wastageCost')}</Label>
                <Input type="number" min={0} step="0.01" value={form.wastage_cost}
                  onChange={(e) => setForm((f) => ({ ...f, wastage_cost: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('production.orders.notes')}</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>

            {/* ── Raw Materials ── */}
            <ItemTable
              label={t('production.orders.rawMaterials')}
              rows={form.materials}
              onChange={(rows) => setForm((f) => ({ ...f, materials: rows }))}
              productOptions={productOptions}
              showWastage={false}
            />

            {/* ── Finished Goods Outputs ── */}
            <ItemTable
              label={t('production.orders.finishedGoods')}
              rows={form.outputs}
              onChange={(rows) => setForm((f) => ({ ...f, outputs: rows }))}
              productOptions={productOptions}
              showWastage
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !form.warehouse_id || !form.planned_date}
            >
              {saveMut.isPending ? t('app.loading') : editing ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
