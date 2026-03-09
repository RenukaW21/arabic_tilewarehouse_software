import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockTransferApi } from '@/api/stockTransferApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import type { StockTransfer, StockTransferItem, CreateStockTransferDto } from '@/types/stock.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function StockTransfersPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockTransfer | null>(null);
  const [deleting, setDeleting] = useState<StockTransfer | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [transferItems, setTransferItems] = useState<Array<{ product_id: string; transferred_boxes: number; transferred_pieces?: number }>>([
    { product_id: '', transferred_boxes: 1, transferred_pieces: 0 },
  ]);
  const [formHeader, setFormHeader] = useState({
    transfer_number: '',
    from_warehouse_id: '',
    to_warehouse_id: '',
    status: 'draft' as const,
    transfer_date: new Date().toISOString().slice(0, 10),
    vehicle_number: '',
    notes: '',
  });

  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    sortBy: 'created_at' as const,
    sortOrder: 'DESC' as const,
  };

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses', { limit: 500 }],
    queryFn: () => warehouseApi.getAll({ limit: 500 }),
  });
  const warehouses = warehousesData?.data ?? [];

  const { data: productsData } = useQuery({
    queryKey: ['products', { limit: 500 }],
    queryFn: () => productApi.getAll({ limit: 500 }),
  });
  const products = productsData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['stock-transfers', listParams],
    queryFn: () => stockTransferApi.getAll(listParams),
  });

  const transfers: StockTransfer[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      applySearch(value);
    },
    [applySearch]
  );

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }));

  const openCreate = () => {
    setEditing(null);
    setFormHeader({
      transfer_number: '',
      from_warehouse_id: '',
      to_warehouse_id: '',
      status: 'draft',
      transfer_date: new Date().toISOString().slice(0, 10),
      vehicle_number: '',
      notes: '',
    });
    setTransferItems([{ product_id: '', transferred_boxes: 1, transferred_pieces: 0 }]);
    setDialogOpen(true);
  };

  const openEdit = async (r: StockTransfer) => {
    try {
      const full = await stockTransferApi.getById(r.id);
      setEditing(full);
      setFormHeader({
        transfer_number: full.transfer_number,
        from_warehouse_id: full.from_warehouse_id,
        to_warehouse_id: full.to_warehouse_id,
        status: (full.status as 'draft') || 'draft',
        transfer_date: full.transfer_date ? full.transfer_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        vehicle_number: full.vehicle_number ?? '',
        notes: full.notes ?? '',
      });
      setTransferItems(
        (full.items && full.items.length > 0)
          ? full.items.map((i) => ({
              product_id: i.product_id,
              transferred_boxes: Number(i.transferred_boxes) || 0,
              transferred_pieces: Number(i.transferred_pieces) || 0,
            }))
          : [{ product_id: '', transferred_boxes: 1, transferred_pieces: 0 }]
      );
      setDialogOpen(true);
    } catch (e) {
      toast.error('Failed to load transfer');
    }
  };

  const addItem = () =>
    setTransferItems((prev) => [...prev, { product_id: '', transferred_boxes: 1, transferred_pieces: 0 }]);
  const updateItem = (index: number, patch: Partial<{ product_id: string; transferred_boxes: number; transferred_pieces: number }>) => {
    setTransferItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const removeItem = (index: number) => {
    if (transferItems.length <= 1) return;
    setTransferItems((prev) => prev.filter((_, i) => i !== index));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: CreateStockTransferDto = {
        transfer_number: formHeader.transfer_number,
        from_warehouse_id: formHeader.from_warehouse_id,
        to_warehouse_id: formHeader.to_warehouse_id,
        status: formHeader.status,
        transfer_date: formHeader.transfer_date,
        vehicle_number: formHeader.vehicle_number || null,
        notes: formHeader.notes || null,
        items: transferItems
          .filter((i) => i.product_id)
          .map((i) => ({
            product_id: i.product_id,
            transferred_boxes: i.transferred_boxes,
            transferred_pieces: i.transferred_pieces ?? 0,
          })),
      };
      if (editing) {
        return stockTransferApi.update(editing.id, payload);
      }
      return stockTransferApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? 'Transfer updated' : 'Transfer created');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      const msg =
        e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Operation failed';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => stockTransferApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      setDeleting(null);
      toast.success('Transfer deleted');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      const msg =
        e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Delete failed';
      toast.error(msg);
    },
  });

  const getWarehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? '—';

  const columns = [
    {
      key: 'transfer_number',
      label: 'Transfer #',
      render: (r: StockTransfer) => (
        <span className="font-mono text-sm font-medium">{r.transfer_number}</span>
      ),
    },
    { key: 'from', label: 'From', render: (r: StockTransfer) => getWarehouseName(r.from_warehouse_id) },
    { key: 'to', label: 'To', render: (r: StockTransfer) => getWarehouseName(r.to_warehouse_id) },
    { key: 'status', label: 'Status', render: (r: StockTransfer) => <StatusBadge status={r.status} /> },
    {
      key: 'transfer_date',
      label: 'Date',
      render: (r: StockTransfer) =>
        r.transfer_date ? new Date(r.transfer_date).toLocaleDateString('en-IN') : '—',
    },
    {
      key: 'items_count',
      label: 'Items',
      render: (r: StockTransfer) => (r.items_count != null && r.items_count > 0 ? r.items_count : (r.items?.length ?? '—')),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: StockTransfer) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openEdit(r)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => setDeleting(r)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Stock Transfers"
        subtitle="Transfer stock between warehouses"
        onAdd={openCreate}
        addLabel="New Transfer"
      />

      <DataTableShell<StockTransfer>
        data={transfers}
        columns={columns}
        searchKey="transfer_number"
        searchPlaceholder="Search by transfer number..."
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && (setDialogOpen(false), setEditing(null))}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Transfer' : 'New Transfer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Transfer #</Label>
                <Input
                  value={formHeader.transfer_number}
                  onChange={(e) => setFormHeader((h) => ({ ...h, transfer_number: e.target.value }))}
                  placeholder="ST-2024-0001"
                />
              </div>
              <div className="space-y-2">
                <Label>Transfer Date</Label>
                <Input
                  type="date"
                  value={formHeader.transfer_date}
                  onChange={(e) => setFormHeader((h) => ({ ...h, transfer_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Warehouse</Label>
                <Select
                  value={formHeader.from_warehouse_id}
                  onValueChange={(v) => setFormHeader((h) => ({ ...h, from_warehouse_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Warehouse</Label>
                <Select
                  value={formHeader.to_warehouse_id}
                  onValueChange={(v) => setFormHeader((h) => ({ ...h, to_warehouse_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formHeader.status}
                  onValueChange={(v) => setFormHeader((h) => ({ ...h, status: v as 'draft' }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Vehicle Number (optional)</Label>
              <Input
                value={formHeader.vehicle_number}
                onChange={(e) => setFormHeader((h) => ({ ...h, vehicle_number: e.target.value }))}
                placeholder="Vehicle number"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={formHeader.notes}
                onChange={(e) => setFormHeader((h) => ({ ...h, notes: e.target.value }))}
                placeholder="Notes"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Transfer Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" /> Add line
                </Button>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Product</th>
                      <th className="px-4 py-2 text-right font-medium w-28">Boxes</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {transferItems.map((row, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-4 py-2">
                          <Select
                            value={row.product_id}
                            onValueChange={(v) => updateItem(idx, { product_id: v })}
                          >
                            <SelectTrigger className="h-9"><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>
                              {productOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="h-9 text-right"
                            value={row.transferred_boxes}
                            onChange={(e) => updateItem(idx, { transferred_boxes: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-4 w-4" />
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
            <Button variant="outline" onClick={() => (setDialogOpen(false), setEditing(null))}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={
                !formHeader.transfer_number ||
                !formHeader.from_warehouse_id ||
                !formHeader.to_warehouse_id ||
                !formHeader.transfer_date ||
                saveMutation.isPending
              }
            >
              {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}