import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, type StockSummaryRow, type OpeningStockPayload } from '@/api/inventoryApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { Button } from '@/components/ui/button';
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
import { useTranslation } from 'react-i18next';

export default function InventoryStockPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'product_name' | 'warehouse_name' | 'total_boxes' | 'total_pieces' | 'total_sqft' | 'updated_at'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [openingModalOpen, setOpeningModalOpen] = useState(false);

  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    sortBy,
    sortOrder,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['inventory-stock', listParams],
    queryFn: () => inventoryApi.getStockList(listParams),
  });

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
  const rows: StockSummaryRow[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      applySearch(value);
    },
    [applySearch]
  );

  const createOpeningMutation = useMutation({
    mutationFn: (payload: OpeningStockPayload) => inventoryApi.createOpeningStock(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-stock'] });
      setOpeningModalOpen(false);
      toast.success('Opening stock created');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? 'Failed to create opening stock');
    },
  });

  const columns = [
    {
      key: 'code',
      label: t('stockSummary.code'),
      render: (r: StockSummaryRow) => <span className="font-mono text-sm">{r.code ?? '-'}</span>,
    },
    { key: 'product_name', label: t('stockSummary.product'), render: (r: StockSummaryRow) => r.product_name ?? '-' },
    { key: 'warehouse_name', label: t('stockSummary.warehouse'), render: (r: StockSummaryRow) => r.warehouse_name ?? '-' },
    {
      key: 'total_boxes',
      label: 'Total (boxes)',
      render: (r: StockSummaryRow) => (
        <span className="font-medium">{Number(r.total_boxes ?? 0).toLocaleString()}</span>
      ),
    },
    {
      key: 'reserved_boxes',
      label: 'Reserved',
      render: (r: StockSummaryRow) => {
        const v = Number(r.reserved_boxes ?? 0);
        return v > 0
          ? <span className="text-amber-600 font-medium">{v.toLocaleString()}</span>
          : <span className="text-muted-foreground">0</span>;
      },
    },
    {
      key: 'available_boxes',
      label: 'Available',
      render: (r: StockSummaryRow) => {
        const v = Number(r.available_boxes ?? 0);
        return (
          <span className={v <= 0 ? 'text-destructive font-semibold' : 'text-green-600 font-semibold'}>
            {v.toLocaleString()}
          </span>
        );
      },
    },
    {
      key: 'total_pieces',
      label: t('stockSummary.pieces'),
      render: (r: StockSummaryRow) => Number(r.total_pieces ?? 0).toLocaleString(),
    },
    {
      key: 'total_sqft',
      label: t('stockSummary.totalSqft'),
      render: (r: StockSummaryRow) => Number(r.total_sqft ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('inventoryStock.title')}
        subtitle={t('inventoryStock.subtitle')}
        onAdd={() => setOpeningModalOpen(true)}
        addLabel={t('inventoryStock.addOpeningStock')}
      />

      {isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load stock'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-muted-foreground text-sm">{t('inventoryStock.sort')}:</Label>
        <Select
          value={sortBy}
          onValueChange={(v) => {
            setSortBy(v as typeof sortBy);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="code">{t('stockSummary.code')}</SelectItem>
            <SelectItem value="product_name">{t('stockSummary.product')}</SelectItem>
            <SelectItem value="warehouse_name">{t('stockSummary.warehouse')}</SelectItem>
            <SelectItem value="total_boxes">{t('stockSummary.boxes')}</SelectItem>
            <SelectItem value="total_pieces">{t('stockSummary.pieces')}</SelectItem>
            <SelectItem value="total_sqft">{t('stockSummary.totalSqft')}</SelectItem>
            <SelectItem value="updated_at">{t('inventoryStock.updated')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortOrder}
          onValueChange={(v) => {
            setSortOrder(v as 'ASC' | 'DESC');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ASC">{t('inventoryStock.asc')}</SelectItem>
            <SelectItem value="DESC">{t('inventoryStock.desc')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTableShell<StockSummaryRow>
        data={rows}
        columns={columns}
        searchKey="code"
        searchPlaceholder="Search by product name or code..."
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      <OpeningStockModal
        open={openingModalOpen}
        onClose={() => setOpeningModalOpen(false)}
        onSubmit={(payload) => createOpeningMutation.mutateAsync(payload)}
        loading={createOpeningMutation.isPending}
        warehouses={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        products={products.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
      />
    </div>
  );
}

interface OpeningStockModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: OpeningStockPayload) => Promise<void>;
  loading: boolean;
  warehouses: { value: string; label: string }[];
  products: { value: string; label: string }[];
}

function OpeningStockModal({
  open,
  onClose,
  onSubmit,
  loading,
  warehouses,
  products,
}: OpeningStockModalProps) {
  const { t } = useTranslation();
  const [warehouse_id, setWarehouseId] = useState('');
  const [product_id, setProductId] = useState('');
  const [boxes, setBoxes] = useState('');
  const [pieces, setPieces] = useState('0');
  const [notes, setNotes] = useState('');

  const { data: warehouseProductsData } = useQuery({
    queryKey: ['opening-stock-warehouse-products', warehouse_id],
    queryFn: () => inventoryApi.getStockList({ warehouse_id, limit: 1000 }),
    enabled: !!warehouse_id,
  });

  const filteredProducts = useMemo(() => {
    if (!warehouse_id) return [];
    const warehouseRows = warehouseProductsData?.data ?? [];
    return products.filter((product) =>
      warehouseRows.some((row) => row.product_id === product.value)
    );
  }, [warehouse_id, warehouseProductsData?.data, products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const b = Number(boxes) || 0;
    if (!warehouse_id || !product_id || b <= 0) return;
    await onSubmit({
      warehouse_id,
      product_id,
      boxes: b,
      pieces: Number(pieces) || 0,
      notes: notes.trim() || null,
    });
    setWarehouseId('');
    setProductId('');
    setBoxes('');
    setPieces('0');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('inventoryStock.addOpeningStock')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('inventory.warehouse')}</Label>
            <Select
              value={warehouse_id}
              onValueChange={(value) => {
                setWarehouseId(value);
                setProductId('');
              }}
              required
            >
              <SelectTrigger><SelectValue placeholder={t('inventoryStock.selectWarehouse')} /></SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('inventory.product')}</Label>
            <Select value={product_id} onValueChange={setProductId} required disabled={!warehouse_id || filteredProducts.length === 0}>
              <SelectTrigger><SelectValue placeholder={!warehouse_id ? t('inventoryStock.selectWarehouse') : t('inventoryStock.selectProduct')} /></SelectTrigger>
              <SelectContent>
                {filteredProducts.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {warehouse_id && filteredProducts.length === 0 && (
              <p className="text-xs text-muted-foreground">Selected warehouse me abhi koi product available nahi hai.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('stockSummary.boxes')}</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={boxes}
                onChange={(e) => setBoxes(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('stockSummary.pieces')}</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={pieces}
                onChange={(e) => setPieces(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('inventoryStock.notesOptional')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('inventoryStock.placeholderOpeningBalance')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={loading}>{loading ? t('common.saving') : t('common.create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
