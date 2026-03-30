import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockTransferApi } from '@/api/stockTransferApi';
import { warehouseApi } from '@/api/warehouseApi';
import { inventoryApi } from '@/api/inventoryApi';

// import type { StockTransfer, CreateStockTransferDto } from '@/types/stock.types';

import type { StockTransfer, CreateStockTransferDto } from '@/types/stock.types';
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
import { Pencil, Trash2, Plus, Loader2, CheckCircle2, PackageCheck, Eye } from 'lucide-react';
import { StockTransferViewModal } from '@/components/features/stock-transfers/StockTransferViewModal';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const statusOptions = [
  { value: 'draft', label: 'draft' },
  { value: 'in_transit', label: 'in_transit' },
  { value: 'received', label: 'received' },
  { value: 'cancelled', label: 'cancelled' },
];

export default function StockTransfersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockTransfer | null>(null);
  const [deleting, setDeleting] = useState<StockTransfer | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [transferItems, setTransferItems] = useState<Array<{ product_id: string; transferred_boxes: number; transferred_pieces?: number }>>([
    { product_id: '', transferred_boxes: 1, transferred_pieces: 0 },
  ]);
  // const [fetchingNumber, setFetchingNumber] = useState(false);
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

  const { data: warehouseStockData, isFetching: stockFetching } = useQuery({
    queryKey: ['inventory-stock', formHeader.from_warehouse_id],
    queryFn: () =>
      inventoryApi.getStockList({ warehouse_id: formHeader.from_warehouse_id, limit: 500 }),
    enabled: !!formHeader.from_warehouse_id,
  });

  // Aggregate available_boxes per product across all rack/shade/batch bins
  const productStockMap = new Map<string, { product_id: string; code: string; product_name: string; available_boxes: number }>();
  for (const row of warehouseStockData?.data ?? []) {
    const existing = productStockMap.get(row.product_id);
    if (existing) {
      existing.available_boxes += Number(row.available_boxes) || 0;
    } else {
      productStockMap.set(row.product_id, {
        product_id: row.product_id,
        code: row.code,
        product_name: row.product_name,
        available_boxes: Number(row.available_boxes) || 0,

  
  });
  // const products = productsData?.data ?? [];

   }
  }
  const productsWithStock = [...productStockMap.values()].filter((p) => p.available_boxes > 0);


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
  const toWarehouseOptions = warehouseOptions.filter((w) => w.value !== formHeader.from_warehouse_id);
  // const productOptions = products.map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }));

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
      toast.error(t('stockTransfers.failedToLoad'));
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

  // Validate each item against available stock before saving
  const stockErrors: string[] = transferItems
    .filter((i) => i.product_id)
    .flatMap((i) => {
      const avail = productStockMap.get(i.product_id)?.available_boxes ?? 0;
      return i.transferred_boxes > avail
        ? [`${productStockMap.get(i.product_id)?.code ?? i.product_id}: requested ${i.transferred_boxes}, available ${avail}`]
        : [];
    });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (stockErrors.length > 0) {
        throw new Error('Insufficient stock: ' + stockErrors.join('; '));
      }
      const payload: CreateStockTransferDto = {

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
      toast.success(editing ? t('stockTransfers.transferUpdated') : t('stockTransfers.transferCreated'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => stockTransferApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      setDeleting(null);
      toast.success(t('stockTransfers.transferDeleted'));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => stockTransferApi.confirm(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      toast.success(t('stockTransfers.transferConfirmed'));
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => stockTransferApi.receive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      toast.success(t('stockTransfers.transferReceived'));
    },
  });

  const getWarehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? '—';

  const columns = [
    {
      key: 'transfer_number',
      label: t('stockTransfers.transferNumber'),
      render: (r: StockTransfer) => (
        <span className="font-mono text-sm font-medium">{r.transfer_number}</span>
      ),
    },
    { key: 'from', label: t('stockTransfers.from'), render: (r: StockTransfer) => getWarehouseName(r.from_warehouse_id) },
    { key: 'to', label: t('stockTransfers.to'), render: (r: StockTransfer) => getWarehouseName(r.to_warehouse_id) },
    { key: 'status', label: t('common.status'), render: (r: StockTransfer) => <StatusBadge status={r.status} /> },
    {
      key: 'transfer_date',
      label: t('common.date'),
      render: (r: StockTransfer) =>
        r.transfer_date ? new Date(r.transfer_date).toLocaleDateString('en-IN') : '—',
    },
    {
      key: 'items_count',
      label: t('stockTransfers.items'),
      render: (r: StockTransfer) => (r.items_count != null && r.items_count > 0 ? r.items_count : (r.items?.length ?? '—')),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (r: StockTransfer) => (
        <div className="flex gap-1">
          {r.status === 'draft' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-600 hover:text-green-700"
                title={t('stockTransfers.confirm')}
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate(r.id)}
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t('common.edit')}
                onClick={() => openEdit(r)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                title={t('common.delete')}
                onClick={() => setDeleting(r)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {r.status === 'in_transit' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-600 hover:text-green-700"
                title={t('stockTransfers.markReceived')}
                disabled={receiveMutation.isPending}
                onClick={() => receiveMutation.mutate(r.id)}
              >
                {receiveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PackageCheck className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-600 hover:text-blue-700"
                title={t('common.view')}
                onClick={() => setViewingId(r.id)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </>
          )}
          {r.status === 'received' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600 hover:text-blue-700"
              title={t('common.view')}
              onClick={() => setViewingId(r.id)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('stockTransfers.title')}
        subtitle={t('stockTransfers.subtitle')}
        onAdd={openCreate}
        addLabel={t('stockTransfers.newTransfer')}
      />

      <DataTableShell<StockTransfer>
        data={transfers}
        columns={columns}
        searchKey="transfer_number"
        searchPlaceholder={t('stockTransfers.searchPlaceholder')}
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
            <DialogTitle>{editing ? t('stockTransfers.editTransfer') : t('stockTransfers.newTransfer')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('stockTransfers.transferNumber')}</Label>
                
                  <Input
                    value={formHeader.transfer_number}
                    readOnly
                  placeholder={t('stockTransfers.placeholderTransferNumber')}
                  className="bg-muted text-muted-foreground"
                />
                    
              </div>
              <div className="space-y-2">
                <Label>{t('stockTransfers.transferDate')}</Label>
                <Input
                  type="date"
                  value={formHeader.transfer_date}
                  onChange={(e) => setFormHeader((h) => ({ ...h, transfer_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('stockTransfers.fromWarehouse')}</Label>
                <Select
                  value={formHeader.from_warehouse_id}
                  onValueChange={(v) => setFormHeader((h) => ({ ...h, from_warehouse_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('stockTransfers.toWarehouse')}</Label>
                <Select
                  value={formHeader.to_warehouse_id}
                  onValueChange={(v) => setFormHeader((h) => ({ ...h, to_warehouse_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                  <SelectContent>
                    {toWarehouseOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>{t('common.status')}</Label>
                <Select
                  value={formHeader.status}
  onValueChange={(v) =>
                    setFormHeader((h) => ({
                      ...h,
                      status: v as typeof formHeader.status,
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.value === 'in_transit' ? t('common.inTransit') : t(`common.${o.value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t('stockTransfers.vehicleNumber')}</Label>
              <Input
                value={formHeader.vehicle_number}
                onChange={(e) => setFormHeader((h) => ({ ...h, vehicle_number: e.target.value }))}
                placeholder={t('stockTransfers.placeholderVehicleNumber')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('stockTransfers.notesOptional')}</Label>
              <Input
                value={formHeader.notes}
                onChange={(e) => setFormHeader((h) => ({ ...h, notes: e.target.value }))}
                placeholder={t('stockTransfers.placeholderNotes')}
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>{t('stockTransfers.transferItems')}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" /> {t('common.addLine')}
                </Button>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">{t('common.product')}</th>
                      <th className="px-4 py-2 text-right font-medium w-28">{t('stockTransfers.boxes')}</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {transferItems.map((row, idx) => {
                      const availStock = row.product_id ? (productStockMap.get(row.product_id)?.available_boxes ?? 0) : null;
                      const overStock = availStock !== null && row.transferred_boxes > availStock;
                      return (
                      <tr key={idx} className="border-b">
                        <td className="px-4 py-2">
                          <Select
                            value={row.product_id}
                            onValueChange={(v) => {
                              const maxAvail = productStockMap.get(v)?.available_boxes ?? 0;
                              updateItem(idx, {
                                product_id: v,
                                transferred_boxes: Math.min(row.transferred_boxes, maxAvail || row.transferred_boxes),
                              });
                            }}
                             disabled={!formHeader.from_warehouse_id || stockFetching}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder={
                                !formHeader.from_warehouse_id
                                  ? t('stockTransfers.selectFromWarehouseFirst')
                                  : stockFetching
                                  ? t('common.loading')
                                  : t('common.product')
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              {productsWithStock.length === 0 && !stockFetching ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                  {t('stockTransfers.noStockInWarehouse')}
                                </div>
                              ) : (
                                productsWithStock.map((p) => (
                                  <SelectItem key={p.product_id} value={p.product_id}>
                                    {p.code} – {p.product_name}
                                    <span className="ml-2 text-muted-foreground">({p.available_boxes} {t('stockTransfers.boxes')})</span>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <div className="space-y-0.5">
                          <Input
                            type="number"
                            min={0}
                            max={availStock ?? undefined}
                            step={0.01}
                            className={`h-9 text-right ${overStock ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                            value={row.transferred_boxes}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              updateItem(idx, { transferred_boxes: val });
                            }}
                          />
                          {availStock !== null && (
                            <p className={`text-[11px] text-right ${overStock ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                              {overStock
                                ? `Exceeds available (${availStock})`
                                : `Max: ${availStock}`}
                            </p>
                          )}
                          </div>
                        </td>
                        <td>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {stockErrors.length > 0 && (
            <p className="text-sm text-destructive px-1">
              Insufficient stock: {stockErrors.join(' · ')}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => (setDialogOpen(false), setEditing(null))}>{t('common.cancel')}</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!formHeader.from_warehouse_id || !formHeader.to_warehouse_id || !formHeader.transfer_date || saveMutation.isPending || stockErrors.length > 0}
            >
              {saveMutation.isPending ? t('common.saving') : editing ? t('common.update') : t('common.create')}
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

      <StockTransferViewModal
        transferId={viewingId}
        open={!!viewingId}
        onClose={() => setViewingId(null)}
        getWarehouseName={getWarehouseName}
      />
    </div>
  );
}