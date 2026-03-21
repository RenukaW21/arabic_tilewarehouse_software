import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  salesReturnsApi,
  type SalesReturn,
  type CreateSalesReturnDto,
} from '@/api/salesApi';
import { customerApi } from '@/api/customerApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackageCheck, Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { useTranslation } from 'react-i18next';

export default function SalesReturnsPage() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SalesReturn | null>(null);
  const [editingReturn, setEditingReturn] = useState<SalesReturn | null>(null);
  const [editForm, setEditForm] = useState({ return_date: '', return_reason: '', notes: '' });
  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    sortBy: 'return_date',
    sortOrder: 'DESC' as const,
  };

  const { data: customersRes } = useQuery({
    queryKey: ['customers-active'],
    queryFn: () => customerApi.getAll({ limit: 500, is_active: true }),
  });
  const { data: warehousesRes } = useQuery({
    queryKey: ['warehouses-active'],
    queryFn: () => warehouseApi.getAll({ limit: 500 }),
  });
  const { data: productsRes } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => productApi.getAll({ limit: 500 }),
  });
  const customers = customersRes?.data ?? [];
  const warehouses = warehousesRes?.data ?? [];
  const products = productsRes?.data ?? [];

  const { data: listData, isLoading } = useQuery({
    queryKey: ['sales-returns', listParams],
    queryFn: () => salesReturnsApi.getAll(listParams),
  });
  const returns: SalesReturn[] = listData?.data ?? [];
  const meta = listData?.meta ?? null;

  const { data: detailRes } = useQuery({
    queryKey: ['sales-returns', detailId],
    queryFn: () => salesReturnsApi.getById(detailId!),
    enabled: !!detailId,
  });
  const detail: SalesReturn | null = detailRes?.data ?? null;

  const [formCustomerId, setFormCustomerId] = useState('');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formReturnReason, setFormReturnReason] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState<Array<{ product_id: string; returned_boxes: number; unit_price: number }>>([
    { product_id: '', returned_boxes: 1, unit_price: 0 },
  ]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!formCustomerId.trim()) {
        toast.error(t('salesReturns.customerRequired'));
        return Promise.reject(new Error('Validation'));
      }
      if (!formWarehouseId.trim()) {
        toast.error(t('salesReturns.warehouseRequired'));
        return Promise.reject(new Error('Validation'));
      }
      if (!formReturnReason.trim()) {
        toast.error(t('salesReturns.reasonRequired'));
        return Promise.reject(new Error('Validation'));
      }
      const validItems = formItems.filter((i) => i.product_id && Number(i.returned_boxes) > 0);
      if (validItems.length === 0) {
        toast.error(t('salesReturns.addAtLeastOneItem'));
        return Promise.reject(new Error('Validation'));
      }
      const payload: CreateSalesReturnDto = {
        customer_id: formCustomerId,
        warehouse_id: formWarehouseId,
        return_reason: formReturnReason.trim(),
        notes: formNotes || undefined,
        items: validItems.map((i) => ({
          product_id: i.product_id,
          returned_boxes: Number(i.returned_boxes) || 0,
          unit_price: Number(i.unit_price) || 0,
        })),
      };
      return salesReturnsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-returns'] });
      setCreateOpen(false);
      setFormCustomerId('');
      setFormWarehouseId('');
      setFormReturnReason('');
      setFormNotes('');
      setFormItems([{ product_id: '', returned_boxes: 1, unit_price: 0 }]);
      toast.success(t('salesReturns.created'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Create failed'),
  });

  const receiveMutation = useMutation({
  mutationFn: (id: string) => salesReturnsApi.receive(id),

  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['sales-returns'] });
    if (detailId) {
      qc.invalidateQueries({ queryKey: ['sales-returns', detailId] });
    }
    toast.success(t('salesReturns.received'));
  },

  onError: (e: any) => {
    toast.error(
      e?.response?.data?.error?.message ?? 'Receive failed'
    );
  },
});

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesReturnsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-returns'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['sales-returns', detailId] });
      setDeleting(null);
      toast.success(t('salesReturns.deleted'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      editingReturn
        ? salesReturnsApi.update(editingReturn.id, {
            return_date: editForm.return_date || undefined,
            return_reason: editForm.return_reason || undefined,
            notes: editForm.notes || null,
          })
        : Promise.reject(new Error('No return')),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-returns'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['sales-returns', detailId] });
      setEditingReturn(null);
      toast.success(t('salesReturns.updated'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Update failed'),
  });

  const addLine = () => setFormItems((prev) => [...prev, { product_id: '', returned_boxes: 1, unit_price: 0 }]);
  const updateLine = (index: number, patch: Partial<{ product_id: string; returned_boxes: number; unit_price: number }>) => {
    setFormItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const removeLine = (index: number) => {
    if (formItems.length <= 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const columns = [
    { key: 'return_number', label: t('salesReturns.returnNumber'), render: (r: SalesReturn) => <span className="font-mono text-sm font-medium">{r.return_number}</span> },
    { key: 'customer_name', label: t('salesReturns.customer'), render: (r: SalesReturn) => r.customer_name ?? '—' },
    { key: 'warehouse_name', label: t('salesReturns.warehouse'), render: (r: SalesReturn) => r.warehouse_name ?? '—' },
    { key: 'status', label: t('common.status'), render: (r: SalesReturn) => <StatusBadge status={r.status} /> },
    { key: 'return_date', label: t('salesReturns.returnDate'), render: (r: SalesReturn) => (r.return_date ? new Date(r.return_date).toLocaleDateString() : '—') },
    { key: 'return_reason', label: t('salesReturns.reason'), render: (r: SalesReturn) => r.return_reason ?? '—' },
    { key: 'total_boxes', label: t('salesReturns.boxes'), render: (r: SalesReturn) => r.total_boxes ?? 0 },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (r: SalesReturn) => (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setDetailId(r.id)}>{t('common.view')}</Button>
          {r.status === 'draft' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingReturn(r);
                  setEditForm({
                    return_date: r.return_date ? String(r.return_date).slice(0, 10) : '',
                    return_reason: r.return_reason ?? '',
                    notes: r.notes ?? '',
                  });
                }}
                title="Edit"
              >
                <Pencil className="h-4 w-4 mr-1" /> {t('common.edit')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => receiveMutation.mutate(r.id)}
                disabled={receiveMutation.isPending}
              >
                <PackageCheck className="h-4 w-4 mr-1" /> {t('salesReturns.receive')}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)} title="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('salesReturns.title')}
        subtitle={t('salesReturns.createSubtitle')}
        onAdd={() => setCreateOpen(true)}
        addLabel={t('salesReturns.newReturn')}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{t('common.allStatuses')}</option>
          <option value="draft">{t('common.draft')}</option>
          <option value="received">{t('common.received')}</option>
          <option value="inspected">{t('salesReturns.inspected')}</option>
          <option value="completed">{t('salesReturns.completed')}</option>
          <option value="cancelled">{t('common.cancelled')}</option>
        </select>
      </div>
      <DataTableShell<SalesReturn>
        data={returns}
        columns={columns}
        searchPlaceholder={t('salesReturns.searchPlaceholder')}
        serverSide
        searchValue={searchInput}
        onSearchChange={(v) => { setSearchInput(v); applySearch(v); }}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('salesReturns.newReturn')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('salesReturns.customer')} <span className="text-destructive">*</span></Label>
                <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                  <SelectTrigger><SelectValue placeholder={t('salesReturns.selectCustomer')} /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('salesReturns.warehouse')} <span className="text-destructive">*</span></Label>
                <Select value={formWarehouseId} onValueChange={setFormWarehouseId}>
                  <SelectTrigger><SelectValue placeholder={t('salesReturns.selectWarehouse')} /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('salesReturns.returnReason')} <span className="text-destructive">*</span></Label>
              <Input value={formReturnReason} onChange={(e) => setFormReturnReason(e.target.value)} placeholder={t('salesReturns.placeholderReason')} />
            </div>
            <div className="space-y-2">
              <Label>{t('salesReturns.notes')}</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder={t('salesReturns.placeholderOptional')} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>{t('salesReturns.items')}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> {t('common.addLine')}</Button>
              </div>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">{t('common.product')}</th>
                      <th className="px-4 py-2 text-right font-medium w-28">{t('salesReturns.boxes')}</th>
                      <th className="px-4 py-2 text-right font-medium w-28">{t('salesReturns.unitPrice')}</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {formItems.map((row, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-4 py-2">
                          <Select
                            value={row.product_id}
                            onValueChange={(v) => updateLine(idx, { product_id: v })}
                          >
                            <SelectTrigger className="h-8"><SelectValue placeholder={t('common.product')} /></SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="h-8 text-right"
                            value={row.returned_boxes}
                            onChange={(e) => updateLine(idx, { returned_boxes: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="h-8 text-right"
                            value={row.unit_price}
                            onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-2">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                !formCustomerId ||
                !formWarehouseId ||
                !formReturnReason.trim() ||
                formItems.every((i) => !i.product_id || Number(i.returned_boxes) <= 0) ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detail && (
        <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{detail.return_number}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t('salesReturns.customer')}: {detail.customer_name} · {t('salesReturns.warehouse')}: {detail.warehouse_name} · {t('common.status')}: {detail.status} · {t('salesReturns.reason')}: {detail.return_reason}
            </p>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">{t('common.product')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('salesReturns.boxes')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('salesReturns.unitPrice')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('salesReturns.lineTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items ?? []).map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-4 py-2">{item.product_code} — {item.product_name}</td>
                      <td className="px-4 py-2 text-right">{Number(item.returned_boxes)}</td>
                      <td className="px-4 py-2 text-right">₹{Number(item.unit_price).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">₹{Number(item.line_total ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => { if (deleting) await deleteMutation.mutateAsync(deleting.id); }}
        loading={deleteMutation.isPending}
        title={t('salesReturns.deleteTitle')}
        description={t('salesReturns.deleteDesc')}
      />

      <Dialog open={!!editingReturn} onOpenChange={(open) => !open && setEditingReturn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('salesReturns.editTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('salesReturns.returnDate')}</Label>
              <Input
                type="date"
                value={editForm.return_date}
                onChange={(e) => setEditForm((f) => ({ ...f, return_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('salesReturns.returnReason')}</Label>
              <Input
                value={editForm.return_reason}
                onChange={(e) => setEditForm((f) => ({ ...f, return_reason: e.target.value }))}
                placeholder={t('salesReturns.placeholderReason')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('salesReturns.notes')}</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t('stockTransfers.placeholderNotes')}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReturn(null)}>{t('common.cancel')}</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
