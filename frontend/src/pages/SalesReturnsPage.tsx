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

export default function SalesReturnsPage() {
  const qc = useQueryClient();
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
        toast.error('Customer is required');
        return Promise.reject(new Error('Validation'));
      }
      if (!formWarehouseId.trim()) {
        toast.error('Warehouse is required');
        return Promise.reject(new Error('Validation'));
      }
      if (!formReturnReason.trim()) {
        toast.error('Return reason is required');
        return Promise.reject(new Error('Validation'));
      }
      const validItems = formItems.filter((i) => i.product_id && Number(i.returned_boxes) > 0);
      if (validItems.length === 0) {
        toast.error('Add at least one item with product and quantity greater than 0');
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
      toast.success('Sales return created');
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
    toast.success('Return received; credit note created');
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
      toast.success('Sales return deleted');
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
      toast.success('Return updated');
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
    { key: 'return_number', label: 'Return #', render: (r: SalesReturn) => <span className="font-mono text-sm font-medium">{r.return_number}</span> },
    { key: 'customer_name', label: 'Customer', render: (r: SalesReturn) => r.customer_name ?? '—' },
    { key: 'warehouse_name', label: 'Warehouse', render: (r: SalesReturn) => r.warehouse_name ?? '—' },
    { key: 'status', label: 'Status', render: (r: SalesReturn) => <StatusBadge status={r.status} /> },
    { key: 'return_date', label: 'Date', render: (r: SalesReturn) => (r.return_date ? new Date(r.return_date).toLocaleDateString() : '—') },
    { key: 'return_reason', label: 'Reason', render: (r: SalesReturn) => r.return_reason ?? '—' },
    { key: 'total_boxes', label: 'Boxes', render: (r: SalesReturn) => r.total_boxes ?? 0 },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: SalesReturn) => (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setDetailId(r.id)}>View</Button>
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
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => receiveMutation.mutate(r.id)}
                disabled={receiveMutation.isPending}
              >
                <PackageCheck className="h-4 w-4 mr-1" /> Receive
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
        title="Sales Returns"
        subtitle="Create returns; receive to update stock and create credit note"
        onAdd={() => setCreateOpen(true)}
        addLabel="New Return"
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="received">Received</option>
          <option value="inspected">Inspected</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <DataTableShell<SalesReturn>
        data={returns}
        columns={columns}
        searchPlaceholder="Search return # or customer..."
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
            <DialogTitle>New sales return</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer <span className="text-destructive">*</span></Label>
                <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Warehouse <span className="text-destructive">*</span></Label>
                <Select value={formWarehouseId} onValueChange={setFormWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Return reason <span className="text-destructive">*</span></Label>
              <Input value={formReturnReason} onChange={(e) => setFormReturnReason(e.target.value)} placeholder="Reason" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> Add line</Button>
              </div>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Product</th>
                      <th className="px-4 py-2 text-right font-medium w-28">Boxes</th>
                      <th className="px-4 py-2 text-right font-medium w-28">Unit price</th>
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
                            <SelectTrigger className="h-8"><SelectValue placeholder="Product" /></SelectTrigger>
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
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
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
              Create
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
              Customer: {detail.customer_name} · Warehouse: {detail.warehouse_name} · Status: {detail.status} · Reason: {detail.return_reason}
            </p>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Boxes</th>
                    <th className="px-4 py-2 text-right font-medium">Unit price</th>
                    <th className="px-4 py-2 text-right font-medium">Line total</th>
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
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        title="Delete sales return"
        description="Only draft returns can be deleted. Are you sure?"
      />

      <Dialog open={!!editingReturn} onOpenChange={(open) => !open && setEditingReturn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit return (draft)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Return date</Label>
              <Input
                type="date"
                value={editForm.return_date}
                onChange={(e) => setEditForm((f) => ({ ...f, return_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Return reason</Label>
              <Input
                value={editForm.return_reason}
                onChange={(e) => setEditForm((f) => ({ ...f, return_reason: e.target.value }))}
                placeholder="Reason"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notes"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReturn(null)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
