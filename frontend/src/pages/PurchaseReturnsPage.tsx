import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseReturnApi } from '@/api/miscApi';
import { vendorApi } from '@/api/vendorApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import type { PurchaseReturn, CreatePurchaseReturnDto, CreatePurchaseReturnItemDto } from '@/types/misc.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertTriangle } from 'lucide-react';

export default function PurchaseReturnsPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseReturn | null>(null);
  const [deleting, setDeleting] = useState<PurchaseReturn | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [formVendorId, setFormVendorId] = useState('');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formReturnDate, setFormReturnDate] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formVehicle, setFormVehicle] = useState('');
  const [formItems, setFormItems] = useState<CreatePurchaseReturnItemDto[]>([
    { product_id: '', returned_boxes: 1, unit_price: 0 },
  ]);

  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    sortBy: 'created_at',
    sortOrder: 'DESC' as const,
  };

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', { limit: 500 }],
    queryFn: () => vendorApi.getAll({ limit: 500 }),
  });
  const vendors = vendorsData?.data ?? [];

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses', { limit: 500 }],
    queryFn: () => warehouseApi.getAll({ limit: 500 }),
  });
  const warehouses = warehousesData?.data ?? [];

  const { data: productsData } = useQuery({
    queryKey: ['products', { limit: 500 }],
    queryFn: () => productApi.getAll({ page: 1, limit: 500 }),
  });
  const products = productsData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-returns', listParams],
    queryFn: () => purchaseReturnApi.getAll(listParams),
  });

  const returnsList: PurchaseReturn[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      applySearch(value);
    },
    [applySearch]
  );

  const createMutation = useMutation({
    mutationFn: async (payload: CreatePurchaseReturnDto) => purchaseReturnApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-returns'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Purchase return created. Stock has been reduced.');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      const msg =
        e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Create failed';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { return_date?: string; reason?: string; notes?: string | null; vehicle_number?: string | null } }) =>
      purchaseReturnApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-returns'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success('Return updated');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? 'Update failed');
    },
  });

  function resetForm() {
    const today = new Date().toISOString().slice(0, 10);
    setFormVendorId('');
    setFormWarehouseId('');
    setFormReturnDate(today);
    setFormReason('');
    setFormNotes('');
    setFormVehicle('');
    setFormItems([{ product_id: '', returned_boxes: 1, unit_price: 0 }]);
  }

  const openCreate = () => {
    resetForm();
    setFormReturnDate(new Date().toISOString().slice(0, 10));
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (r: PurchaseReturn) => {
    if (r.status !== 'draft') return;
    setEditing(r);
    setFormReturnDate(r.return_date ? r.return_date.slice(0, 10) : '');
    setFormReason(r.reason ?? '');
    setFormNotes(r.notes ?? '');
    setFormVehicle(r.vehicle_number ?? '');
    setFormVendorId(r.vendor_id);
    setFormWarehouseId(r.warehouse_id);
    setDialogOpen(true);
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = formItems.filter((i) => i.product_id && i.returned_boxes > 0);
    if (!formVendorId || !formWarehouseId || !formReturnDate || !formReason) return;
    if (validItems.length === 0) return;
    await createMutation.mutateAsync({
      vendor_id: formVendorId,
      warehouse_id: formWarehouseId,
      return_date: formReturnDate,
      reason: formReason,
      notes: formNotes || null,
      vehicle_number: formVehicle || null,
      items: validItems.map((i) => ({
        product_id: i.product_id,
        shade_id: i.shade_id ?? null,
        batch_id: i.batch_id ?? null,
        returned_boxes: i.returned_boxes,
        returned_pieces: i.returned_pieces ?? 0,
        unit_price: i.unit_price,
        return_reason: i.return_reason ?? null,
      })),
    });
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await updateMutation.mutateAsync({
      id: editing.id,
      payload: {
        return_date: formReturnDate,
        reason: formReason,
        notes: formNotes || null,
        vehicle_number: formVehicle || null,
      },
    });
  };

  const addReturnItem = () => setFormItems((prev) => [...prev, { product_id: '', returned_boxes: 1, unit_price: 0 }]);
  const removeReturnItem = (index: number) => {
    if (formItems.length <= 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };
  const updateReturnItem = (index: number, patch: Partial<CreatePurchaseReturnItemDto>) => {
    setFormItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));
  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));

  const columns = [
    {
      key: 'return_number',
      label: 'Return #',
      render: (r: PurchaseReturn) => <span className="font-mono text-sm font-medium">{r.return_number}</span>,
    },
    { key: 'vendor_name', label: 'Vendor', render: (r: PurchaseReturn) => r.vendor_name ?? r.vendor_id },
    { key: 'warehouse_name', label: 'Warehouse', render: (r: PurchaseReturn) => r.warehouse_name ?? r.warehouse_id },
    { key: 'status', label: 'Status', render: (r: PurchaseReturn) => <StatusBadge status={r.status} /> },
    {
      key: 'return_date',
      label: 'Date',
      render: (r: PurchaseReturn) => (r.return_date ? new Date(r.return_date).toLocaleDateString() : '—'),
    },
    { key: 'total_boxes', label: 'Boxes', render: (r: PurchaseReturn) => r.total_boxes ?? 0 },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: PurchaseReturn) => (
        <div className="flex gap-1">
          {r.status === 'draft' && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const isEdit = !!editing;

  return (
    <div>
      <PageHeader
        title="Purchase Returns"
        subtitle="Manage purchase returns to vendors. Creating a return reduces stock."
        onAdd={openCreate}
        addLabel="New Return"
      />

      <DataTableShell<PurchaseReturn>
        data={returnsList}
        columns={columns}
        searchKey="return_number"
        searchPlaceholder="Search by return #..."
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && (setDialogOpen(false), setEditing(null))}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Purchase Return' : 'New Purchase Return'}</DialogTitle>
          </DialogHeader>
          {!isEdit && (
            <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Creating a return will reduce stock for the selected warehouse. Return quantity must not exceed available stock (unallocated).
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={isEdit ? handleSubmitEdit : handleSubmitCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Select value={formVendorId} onValueChange={setFormVendorId} required disabled={isEdit}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendorOptions.map((v) => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <Select value={formWarehouseId} onValueChange={setFormWarehouseId} required disabled={isEdit}>
                  <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map((w) => (
                      <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Return Date</Label>
                <Input type="date" value={formReturnDate} onChange={(e) => setFormReturnDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input value={formReason} onChange={(e) => setFormReason(e.target.value)} placeholder="Reason for return" required />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Vehicle Number</Label>
                <Input value={formVehicle} onChange={(e) => setFormVehicle(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Notes</Label>
                <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>

            {!isEdit && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Return Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addReturnItem}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="text-left px-2 py-2 font-medium">Product</th>
                        <th className="text-right px-2 py-2 font-medium w-24">Boxes</th>
                        <th className="text-right px-2 py-2 font-medium w-28">Unit Price</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formItems.map((item, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="px-2 py-1.5">
                            <Select
                              value={item.product_id || 'none'}
                              onValueChange={(v) => {
                                if (v === 'none') return;
                                const p = products.find((x) => x.id === v);
                                updateReturnItem(idx, { product_id: v, unit_price: p?.mrp ?? 0 });
                              }}
                            >
                              <SelectTrigger className="h-8"><SelectValue placeholder="Product" /></SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className="h-8 text-right"
                              value={item.returned_boxes}
                              onChange={(e) => updateReturnItem(idx, { returned_boxes: Math.max(0, Number(e.target.value) || 0) })}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className="h-8 text-right"
                              value={item.unit_price}
                              onChange={(e) => updateReturnItem(idx, { unit_price: Number(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeReturnItem(idx)} disabled={formItems.length <= 1}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={createMutation.isPending || updateMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create Return'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
