import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockAdjustmentsApi, type StockAdjustment, type CreateStockAdjustmentPayload } from '@/api/stockAdjustmentsApi';
import { warehouseApi, rackApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import { inventoryApi } from '@/api/inventoryApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CrudFormDialog, FieldDef } from '@/components/shared/CrudFormDialog';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function StockAdjustmentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockAdjustment | null>(null);
  const [viewing, setViewing] = useState<StockAdjustment | null>(null);
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
  const allProducts = productsData?.data ?? [];

  const { data: warehouseProductsData } = useQuery({
    queryKey: ['warehouse-products', selectedWarehouseId],
    queryFn: () => inventoryApi.getStockList({ warehouse_id: selectedWarehouseId!, limit: 1000 }),
    enabled: !!selectedWarehouseId,
  });

  const warehouseProducts = warehouseProductsData?.data ?? [];

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


  const { data: shadesData } = useQuery({
    queryKey: ['product-shades', selectedProductId],
    queryFn: () => productApi.getShades(selectedProductId!),
    enabled: !!selectedProductId,
  });

  const { data: racksData } = useQuery({
    queryKey: ['warehouse-racks', selectedWarehouseId],
    queryFn: () => rackApi.getAll({ warehouse_id: selectedWarehouseId!, limit: 500 }),
    enabled: !!selectedWarehouseId,
  });

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));
  
  // Deduplicate products for the selected warehouse
  const filteredProducts = selectedWarehouseId && warehouseProducts.length > 0
    ? Array.from(new Map(warehouseProducts.map(p => [p.product_id, { id: p.product_id, code: p.code, name: p.product_name }])).values())
    : allProducts;

  const productOptions = filteredProducts.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
  const shadeOptions = (shadesData?.data ?? []).map((s: any) => ({ value: s.id, label: s.shade_name || s.shade_code || s.name }));
  const rackOptions = (racksData?.data ?? []).map((r: any) => ({ value: r.id, label: `${r.name} (${r.available_boxes ?? 0} avail)` }));

  const fields: FieldDef[] = [
    { key: 'warehouse_id', label: t('stockAdjustments.warehouse'), type: 'select', required: true, options: warehouseOptions },
    { key: 'product_id', label: t('stockAdjustments.product'), type: 'select', required: true, options: productOptions },
    { key: 'shade_id', label: t('common.shade', 'Shade'), type: 'select', options: shadeOptions, placeholder: t('common.selectShade', 'Select Shade') },
    { key: 'rack_id', label: t('common.rack', 'Rack'), type: 'select', options: rackOptions, placeholder: t('common.selectRack', 'Select Rack') },
    { key: 'adjustment_type', label: t('stockAdjustments.type'), type: 'select', required: true, options: [{ value: 'add', label: t('stockAdjustments.typeAdd') }, { value: 'deduct', label: t('stockAdjustments.typeDeduct') }], defaultValue: 'add' },
    { key: 'boxes', label: t('stockAdjustments.boxes'), type: 'number', defaultValue: 0, required: true },
    { key: 'pieces', label: t('common.pieces', 'Pieces'), type: 'number', defaultValue: 0 },
    { key: 'reason', label: t('stockAdjustments.reason'), type: 'text', required: true },
  ];

  const saveMutation = useMutation({
    mutationFn: async (fd: Record<string, unknown>) => {
      const payload: CreateStockAdjustmentPayload = {
        warehouse_id: String(fd.warehouse_id),
        product_id: String(fd.product_id),
        shade_id: fd.shade_id ? String(fd.shade_id) : undefined,
        rack_id: fd.rack_id ? String(fd.rack_id) : undefined,
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
      setSelectedProductId(null);
      setSelectedWarehouseId(null);
      toast.success(editing ? t('stockAdjustments.updated') : t('stockAdjustments.created'));
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error?.message ?? t('common.operationFailed', 'Operation Failed'));
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => stockAdjustmentsApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
      qc.invalidateQueries({ queryKey: ['productInventory'] });
      qc.invalidateQueries({ queryKey: ['inventory-stock'] });
      toast.success(t('stockAdjustments.approved'));
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error?.message ?? t('common.approveFailed', 'Approval Failed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => stockAdjustmentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
      setDeleting(null);
      toast.success(t('stockAdjustments.deleted'));
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error?.message ?? t('common.deleteFailed', 'Delete Failed'));
    },
  });

  const columns = [
    { key: 'product', label: t('stockAdjustments.product'), render: (r: StockAdjustment) => (
      <div className="flex flex-col">
        <span className="font-medium text-sm">{r.product_code ?? ''} — {r.product_name ?? r.product_id}</span>
        <span className="text-xs text-muted-foreground">{r.warehouse_name ?? '—'} {r.rack_name ? `| Rack ${r.rack_name}` : ''} {r.shade_name ? `| Shade ${r.shade_name}` : ''}</span>
      </div>
    ) },
    { key: 'adjustment_type', label: t('stockAdjustments.type'), render: (r: StockAdjustment) => r.adjustment_type === 'add' ? <span className="text-emerald-600 font-medium">{t('stockAdjustments.typeAdd')}</span> : <span className="text-red-500 font-medium">{t('stockAdjustments.typeDeduct')}</span> },
    { key: 'boxes', label: t('stockAdjustments.boxes'), render: (r: StockAdjustment) => <div className="font-mono">{Number(r.boxes).toFixed(2)}</div> },
    { key: 'reason', label: t('stockAdjustments.reason'), render: (r: StockAdjustment) => r.reason },
    { key: 'status', label: t('stockAdjustments.status'), render: (r: StockAdjustment) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: t('stockAdjustments.actions'),
      render: (r: StockAdjustment) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => { setViewing(r); setDialogOpen(true); }} title={t('common.view', 'View')}><Eye className="h-4 w-4" /></Button>
          {r.status === 'pending' && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialogOpen(true); }} title={t('common.edit', 'Edit')}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending} title={t('common.approve', 'Approve')}><CheckCircle className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)} title={t('common.delete', 'Delete')}><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('stockAdjustments.title')} subtitle={t('stockAdjustments.subtitle')} onAdd={() => { setEditing(null); setViewing(null); setDialogOpen(true); }} addLabel={t('stockAdjustments.newAdjustment')} />
      <DataTableShell<StockAdjustment>
        data={rows}
        columns={columns}
        searchKey="reason"
        searchPlaceholder={t('stockAdjustments.searchPlaceholder')}
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />
      <CrudFormDialog 
        open={dialogOpen} 
        onClose={() => { setDialogOpen(false); setEditing(null); setViewing(null); setSelectedProductId(null); setSelectedWarehouseId(null); }} 
        onSubmit={(d) => saveMutation.mutateAsync(d)} 
        fields={fields} 
        title={viewing ? t('stockAdjustments.viewAdjustment', 'Adjustment Details') : editing ? t('stockAdjustments.editAdjustment') : t('stockAdjustments.newAdjustment')} 
        initialData={viewing || editing} 
        readOnly={!!viewing}
        loading={saveMutation.isPending}
        onValueChange={(key, val) => {
          if (key === 'product_id') setSelectedProductId(val as string);
          if (key === 'warehouse_id') setSelectedWarehouseId(val as string);
        }}
      />
      <DeleteConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id)} loading={deleteMutation.isPending} />
    </div>
  );
}
