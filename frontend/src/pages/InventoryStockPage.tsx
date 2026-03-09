import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, type StockSummaryRow, type OpeningStockPayload, type AdjustStockPayload } from '@/api/inventoryApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { Button } from '@/components/ui/button';
import { Plus, SlidersHorizontal } from 'lucide-react';
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

export default function InventoryStockPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'product_name' | 'warehouse_name' | 'total_boxes' | 'total_pieces' | 'total_sqft' | 'updated_at'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const [openingModalOpen, setOpeningModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingRow, setAdjustingRow] = useState<StockSummaryRow | null>(null);

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

  const adjustMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdjustStockPayload }) =>
      inventoryApi.adjustStock(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-stock'] });
      setAdjustModalOpen(false);
      setAdjustingRow(null);
      toast.success('Stock adjusted');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? 'Failed to adjust stock');
    },
  });

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (r: StockSummaryRow) => <span className="font-mono text-sm">{r.code ?? '—'}</span>,
    },
    { key: 'product_name', label: 'Product', render: (r: StockSummaryRow) => r.product_name ?? '—' },
    { key: 'warehouse_name', label: 'Warehouse', render: (r: StockSummaryRow) => r.warehouse_name ?? '—' },
    {
      key: 'total_boxes',
      label: 'Boxes',
      render: (r: StockSummaryRow) => Number(r.total_boxes ?? 0).toLocaleString(),
    },
    {
      key: 'total_pieces',
      label: 'Pieces',
      render: (r: StockSummaryRow) => Number(r.total_pieces ?? 0).toLocaleString(),
    },
    {
      key: 'total_sqft',
      label: 'Total Sqft',
      render: (r: StockSummaryRow) => Number(r.total_sqft ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: StockSummaryRow) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setAdjustingRow(r);
            setAdjustModalOpen(true);
          }}
        >
          <SlidersHorizontal className="h-4 w-4 mr-1" /> Adjust
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory (Stock Summary)"
        subtitle="View and manage stock levels. Add opening stock or adjust quantities."
        onAdd={() => setOpeningModalOpen(true)}
        addLabel="Add Opening Stock"
      />

      {isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load stock'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-muted-foreground text-sm">Sort:</Label>
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
            <SelectItem value="code">Code</SelectItem>
            <SelectItem value="product_name">Product</SelectItem>
            <SelectItem value="warehouse_name">Warehouse</SelectItem>
            <SelectItem value="total_boxes">Boxes</SelectItem>
            <SelectItem value="total_pieces">Pieces</SelectItem>
            <SelectItem value="total_sqft">Total Sqft</SelectItem>
            <SelectItem value="updated_at">Updated</SelectItem>
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
            <SelectItem value="ASC">Asc</SelectItem>
            <SelectItem value="DESC">Desc</SelectItem>
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

      {/* Add Opening Stock Modal */}
      <OpeningStockModal
        open={openingModalOpen}
        onClose={() => setOpeningModalOpen(false)}
        onSubmit={(payload) => createOpeningMutation.mutateAsync(payload)}
        loading={createOpeningMutation.isPending}
        warehouses={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        products={products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
      />

      {/* Adjust Stock Modal */}
      <AdjustStockModal
        open={adjustModalOpen}
        onClose={() => {
          setAdjustModalOpen(false);
          setAdjustingRow(null);
        }}
        row={adjustingRow}
        onSubmit={(payload) =>
          adjustingRow && adjustMutation.mutateAsync({ id: adjustingRow.id, payload })
        }
        loading={adjustMutation.isPending}
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
  const [warehouse_id, setWarehouseId] = useState('');
  const [product_id, setProductId] = useState('');
  const [boxes, setBoxes] = useState('');
  const [pieces, setPieces] = useState('0');
  const [notes, setNotes] = useState('');

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
          <DialogTitle>Add Opening Stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Warehouse</Label>
            <Select value={warehouse_id} onValueChange={setWarehouseId} required>
              <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={product_id} onValueChange={setProductId} required>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Boxes</Label>
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
              <Label>Pieces</Label>
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
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opening balance" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface AdjustStockModalProps {
  open: boolean;
  onClose: () => void;
  row: StockSummaryRow | null;
  onSubmit: (payload: AdjustStockPayload) => Promise<void>;
  loading: boolean;
}

function AdjustStockModal({ open, onClose, row, onSubmit, loading }: AdjustStockModalProps) {
  const [boxes_in, setBoxesIn] = useState('');
  const [boxes_out, setBoxesOut] = useState('');
  const [pieces_in, setPiecesIn] = useState('');
  const [pieces_out, setPiecesOut] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bi = Number(boxes_in) || 0;
    const bo = Number(boxes_out) || 0;
    const pi = Number(pieces_in) || 0;
    const po = Number(pieces_out) || 0;
    if (bi === 0 && bo === 0 && pi === 0 && po === 0) return;
    await onSubmit({
      boxes_in: bi,
      boxes_out: bo,
      pieces_in: pi,
      pieces_out: po,
      notes: notes.trim() || null,
    });
    setBoxesIn('');
    setBoxesOut('');
    setPiecesIn('');
    setPiecesOut('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          {row && (
            <p className="text-sm text-muted-foreground">
              {row.product_name} @ {row.warehouse_name} — Current: {Number(row.total_boxes)} boxes
            </p>
          )}
        </DialogHeader>
        {!row ? (
          <p className="text-muted-foreground">No row selected.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Boxes In</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={boxes_in}
                  onChange={(e) => setBoxesIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Boxes Out</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={boxes_out}
                  onChange={(e) => setBoxesOut(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Pieces In</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={pieces_in}
                  onChange={(e) => setPiecesIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Pieces Out</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={pieces_out}
                  onChange={(e) => setPiecesOut(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Enter at least one non-zero value. Adjustment will update ledger and summary.</p>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for adjustment" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Apply'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
