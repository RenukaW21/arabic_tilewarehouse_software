import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { grnApi } from '@/api/grnApi';
import { productApi } from '@/api/productApi';
import { rackApi } from '@/api/warehouseApi';
import type { GRN, GRNItem, UpdateQualityDto } from '@/types/grn.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, Loader2, ExternalLink, Package,
  Trash2, Plus, ChevronsUpDown, Check, MessageSquare, Pencil, Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product { id: string; name: string; code: string }
interface Shade { id: string; shade_code: string; shade_name: string }

type GRNFull = GRN & {
  purchase_order_id?: string;
  po_number?: string;
  invoice_date?: string;
  vehicle_number?: string;
  notes?: string;
  items?: GRNItemFull[];
};

type GRNItemFull = GRNItem & {
  shade_name?: string;
  shade_code?: string;
  ordered_boxes?: number;
  product_code?: string;
  received_pieces?: number;
  damaged_boxes?: number;
  unit_price?: number;
  rack_name?: string;
  batch_number?: string;
  received_boxes?: number;
  received_qty_boxes?: number;
  rack_id?: string;
};

const qualityOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value ?? '—'}</p>
    </div>
  );
}

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-IN') : '—';
}

// ─── ProductCombobox (search-as-you-type) ─────────────────────────────────────
function ProductCombobox({
  value, label, onChange, disabled = false,
}: {
  value: string; label: string;
  onChange: (id: string, label: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data } = useQuery({
    queryKey: ['products-search', query],
    queryFn: () => productApi.getAll({ search: query, limit: 30, sortBy: 'name', sortOrder: 'ASC' }),
    enabled: open,
  });
  const products: Product[] = data?.data ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button" variant="outline" role="combobox"
          disabled={disabled}
          className={cn('w-full justify-between font-normal text-left h-9', !value && 'text-muted-foreground')}
        >
          <span className="truncate text-sm">{label || 'Search product…'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type name or code…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No products found.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id} value={p.id}
                  onSelect={() => {
                    onChange(p.id, `${p.code} · ${p.name}`);
                    setQuery(''); setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', value === p.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.code}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── ShadeSelect (filtered by product) ───────────────────────────────────────
function ShadeSelect({
  productId, value, onChange, disabled = false,
}: {
  productId: string; value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['shades-for-product', productId],
    queryFn: () => productApi.getShades(productId),
    enabled: !!productId,
  });
  const shades: Shade[] = data?.data ?? [];

  const placeholder = !productId ? 'Select product first'
    : isLoading ? 'Loading…'
      : shades.length === 0 ? 'No shades'
        : 'Select shade (optional)';

  return (
    <Select
      value={value || '__none__'}
      onValueChange={(v) => onChange(v === '__none__' ? '' : v)}
      disabled={disabled || !productId || shades.length === 0}
    >
      <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— No shade —</SelectItem>
        {shades.map((s) => (
          <SelectItem key={s.id} value={s.id}>{s.shade_code} · {s.shade_name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Quality Notes Dialog ─────────────────────────────────────────────────────
function QualityNotesDialog({
  open, onClose, onSave, loading, initialNotes,
}: {
  open: boolean; onClose: () => void;
  onSave: (notes: string) => void;
  loading: boolean; initialNotes?: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes ?? '');
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quality Notes</DialogTitle>
          <DialogDescription>Add optional notes for this quality decision.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. 3 boxes had cracked tiles on corner…"
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={() => onSave(notes)} disabled={loading}>
            {loading ? 'Saving…' : 'Save Notes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Item Panel ───────────────────────────────────────────────────────────
function AddItemPanel({ grnId, onSuccess, existingItems }: { grnId: string; onSuccess: () => void; existingItems: GRNItemFull[] }) {
  const [productId, setProductId] = useState('');
  const [productLabel, setProductLabel] = useState('');
  const [shadeId, setShadeId] = useState('');
  const [receivedBoxes, setReceivedBoxes] = useState('');
  const [receivedPieces, setReceivedPieces] = useState('0');
  const [damagedBoxes, setDamagedBoxes] = useState('0');
  const [unitPrice, setUnitPrice] = useState('');

  const addItemMutation = useMutation({
    mutationFn: (data: Parameters<typeof grnApi.addItem>[1]) => grnApi.addItem(grnId, data),
    onSuccess: () => {
      onSuccess();
      // reset
      setProductId(''); setProductLabel(''); setShadeId('');
      setReceivedBoxes(''); setReceivedPieces('0');
      setDamagedBoxes('0'); setUnitPrice('');
      toast.success('Item added');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Add item failed'),
  });

  const handleAdd = () => {
    const boxes = parseFloat(receivedBoxes) || 0;
    const damaged = parseFloat(damagedBoxes) || 0;
    const price = parseFloat(unitPrice) ?? 0;
    if (!productId) { toast.error('Select a product'); return; }
    if (boxes <= 0) { toast.error('Received boxes must be > 0'); return; }
    if (damaged > boxes) { toast.error('Damaged boxes cannot exceed received boxes'); return; }

    addItemMutation.mutate({
      product_id: productId,
      shade_id: shadeId || null,
      received_boxes: boxes,
      received_pieces: parseFloat(receivedPieces) || 0,
      damaged_boxes: damaged,
      unit_price: price,
    });
  };

  return (
    <div className="rounded-lg border bg-muted/10 p-4 space-y-4">
      <h3 className="text-sm font-semibold">Add Item</h3>

      {/* Product search */}
      <div className="space-y-1">
        <Label className="text-xs">Product <span className="text-destructive">*</span></Label>
        <ProductCombobox
          value={productId}
          label={productLabel}
          onChange={(id, lbl) => {
            setProductId(id); setProductLabel(lbl);
            setShadeId('');   // reset shade on product change
          }}
        />
      </div>

      {/* Shade */}
      <div className="space-y-1">
        <Label className="text-xs">Shade</Label>
        <ShadeSelect productId={productId} value={shadeId} onChange={setShadeId} />
      </div>

      {/* Numeric fields — 2-col grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Received Boxes <span className="text-destructive">*</span></Label>
          <Input
            type="number" min={0} step="0.01" className="h-9"
            placeholder="e.g. 10"
            value={receivedBoxes}
            onChange={(e) => setReceivedBoxes(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unit Price (₹) <span className="text-destructive">*</span></Label>
          <Input
            type="number" min={0} step="0.01" className="h-9"
            placeholder="e.g. 450"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            Received Pieces
            <span className="ml-1 font-normal text-muted-foreground">(loose)</span>
          </Label>
          <Input
            type="number" min={0} step="0.01" className="h-9"
            value={receivedPieces}
            onChange={(e) => setReceivedPieces(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            Damaged Boxes
            <span className="ml-1 font-normal text-muted-foreground">(excluded from stock)</span>
          </Label>
          <Input
            type="number" min={0} step="0.01" className="h-9"
            value={damagedBoxes}
            onChange={(e) => setDamagedBoxes(e.target.value)}
          />
        </div>
      </div>

      <Button
        size="sm" onClick={handleAdd}
        disabled={addItemMutation.isPending || !productId}
        className="w-full"
      >
        {addItemMutation.isPending
          ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Adding…</>
          : <><Plus className="h-4 w-4 mr-2" />Add Item</>
        }
      </Button>
    </div>
  );
}

// ─── Post Stock Preview Dialog ──────────────────────────────────────────────────
function PostPreviewDialog({
  grnItems, open, onClose, onConfirm, loading
}: {
  grnItems: GRNItemFull[]; open: boolean; onClose: () => void;
  onConfirm: () => void; loading: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Stock Impact Preview</AlertDialogTitle>
          <AlertDialogDescription>
            The following inventory changes will be applied:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-[300px] overflow-y-auto space-y-2 py-2">
          {grnItems.map(it => {
            const rcvd = (it as any).received_boxes ?? (it as any).received_qty_boxes ?? 0;
            const netBoxes = Math.max(0, Number(rcvd) - Number(it.damaged_boxes ?? 0));
            if (netBoxes === 0) return null;
            return (
              <div key={it.id} className="flex justify-between items-center text-sm border-b pb-1 last:border-0 hover:bg-muted/10">
                <div className="flex flex-col">
                  <span className="font-semibold">{it.product_name}</span>
                  <span className="text-xs text-muted-foreground">{it.shade_name ? `Shade: ${it.shade_name}` : ''} {it.batch_number ? `Batch: ${it.batch_number}` : ''} {it.rack_name ? `Rack: ${it.rack_name}` : ''}</span>
                </div>
                <span className="font-bold text-green-600">+{netBoxes} boxes</span>
              </div>
            );
          })}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading}>
            {loading ? 'Posting…' : 'Confirm & Post'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Edit Item Dialog ─────────────────────────────────────────────────────────
function EditItemDialog({
  grnId, item, open, onClose, onSuccess, warehouseId
}: {
  grnId: string; item: GRNItemFull | null; open: boolean;
  onClose: () => void; onSuccess: () => void; warehouseId: string;
}) {
  const [receivedBoxes, setReceivedBoxes] = useState('');
  const [receivedPieces, setReceivedPieces] = useState('');
  const [damagedBoxes, setDamagedBoxes] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [rackId, setRackId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');

  const { data: rackData } = useQuery({
    queryKey: ['racks', warehouseId],
    queryFn: () => rackApi.getAll({ warehouse_id: warehouseId, limit: 100 }),
    enabled: open && !!warehouseId,
  });
  const racks = rackData?.data ?? [];

  useEffect(() => {
    if (item && open) {
      const rcvd = (item as any).received_boxes ?? (item as any).received_qty_boxes ?? '';
      setReceivedBoxes(String(rcvd));
      setReceivedPieces(String(item.received_pieces ?? '0'));
      setDamagedBoxes(String(item.damaged_boxes ?? '0'));
      setUnitPrice(String(item.unit_price ?? ''));
      setRackId(item.rack_id ?? '');
      setBatchNumber(item.batch_number ?? '');
    }
  }, [item, open]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => grnApi.updateItem(grnId, item!.id!, data),
    onSuccess: () => {
      onSuccess();
      toast.success('Item updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? 'Update failed'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const boxes = parseFloat(receivedBoxes) || 0;
    const damaged = parseFloat(damagedBoxes) || 0;
    if (damaged > boxes) { toast.error("Damaged boxes cannot exceed received boxes"); return; }

    if (rackId && rackId !== '__none__') {
      const r = racks.find((ra: any) => ra.id === rackId);
      if (r) {
        const avail = (r.capacity_boxes || 0) - (r.occupied_boxes || 0);
        if (boxes > avail) {
          toast.error(`Rack capacity exceeded. Only ${Math.max(0, avail)} boxes available.`);
          return;
        }
      }
    }

    updateMutation.mutate({
      received_boxes: boxes,
      received_pieces: parseFloat(receivedPieces) || 0,
      damaged_boxes: damaged,
      unit_price: parseFloat(unitPrice) || 0,
      rack_id: rackId === '__none__' ? null : rackId || null,
      batch_number: batchNumber || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>{item?.product_name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Received Boxes</Label>
              <Input type="number" step="0.01" value={receivedBoxes} onChange={e => setReceivedBoxes(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Damaged Boxes</Label>
              <Input type="number" step="0.01" value={damagedBoxes} onChange={e => setDamagedBoxes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Received Pieces</Label>
              <Input type="number" step="0.01" value={receivedPieces} onChange={e => setReceivedPieces(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Unit Price (₹)</Label>
              <Input type="number" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rack</Label>
              <Select value={rackId || '__none__'} onValueChange={setRackId}>
                <SelectTrigger><SelectValue placeholder="Select Rack" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No Rack —</SelectItem>
                  {racks.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.rack_name} (Avail: {Math.max(0, (r.capacity_boxes || 0) - (r.occupied_boxes || 0))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Batch Number</Label>
              <Input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="e.g. BATCH-01" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Page
// ═════════════════════════════════════════════════════════════════════════════
export default function GRNDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // quality notes dialog state
  const [qualityDialogItem, setQualityDialogItem] = useState<{
    itemId: string; status: string; notes: string | null;
  } | null>(null);
  const [pendingQualityStatus, setPendingQualityStatus] = useState<string>('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [postPreviewOpen, setPostPreviewOpen] = useState(false);
  const [editItemObj, setEditItemObj] = useState<GRNItemFull | null>(null);
  const [deleteItemObj, setDeleteItemObj] = useState<GRNItemFull | null>(null);

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: grnRes, isLoading, error } = useQuery({
    queryKey: ['grn', id],
    queryFn: () => grnApi.getById(id!),
    enabled: !!id,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────
  const postMutation = useMutation({
    mutationFn: () => grnApi.postGRN(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn', id] });
      qc.invalidateQueries({ queryKey: ['grns'] });
      if (grn?.purchase_order_id) {
        qc.invalidateQueries({ queryKey: ['purchase-orders', grn.purchase_order_id] });
        qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      }
      toast.success('GRN posted — stock and PO updated');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Post failed'),
  });

  const updateQualityMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: UpdateQualityDto }) =>
      grnApi.updateQuality(id!, itemId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn', id] });
      setQualityDialogItem(null);
      toast.success('Quality updated');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => grnApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grns'] });
      toast.success('GRN deleted');
      navigate('/purchase/grn');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => grnApi.deleteItem(id!, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn', id] });
      setDeleteItemObj(null);
      toast.success('Item deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? 'Delete item failed'),
  });

  const printLabelMutation = useMutation({
    mutationFn: (itemId: string) => grnApi.generateLabels(id!, itemId),
    onSuccess: (res) => toast.success('Label generation triggered!'),
    onError: (e: any) => toast.error('Failed to generate label'),
  });

  // ─── Guards ───────────────────────────────────────────────────────────────
  if (!id) return <div className="p-4 text-destructive">Missing GRN ID</div>;

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (error || !grnRes?.data) return (
    <div className="p-4 space-y-3">
      <p className="text-destructive">GRN not found or failed to load.</p>
      <Button variant="outline" size="sm" onClick={() => navigate('/purchase/grn')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
      </Button>
    </div>
  );

  const grn = grnRes.data as GRNFull;
  const canPost = (grn.status === 'draft' || grn.status === 'verified') && (grn.items?.length ?? 0) > 0;
  const isEditable = grn.status === 'draft' || grn.status === 'verified';

  // ─── Quality status change handler ───────────────────────────────────────
  // Opens notes dialog; saves status + notes together
  const handleQualityChange = (item: GRNItemFull, newStatus: string) => {
    setPendingQualityStatus(newStatus);
    setQualityDialogItem({
      itemId: item.id!,
      status: newStatus,
      notes: item.quality_notes as string | null ?? null,
    });
  };

  const handleQualityNoteSave = (notes: string) => {
    if (!qualityDialogItem) return;
    updateQualityMutation.mutate({
      itemId: qualityDialogItem.itemId,
      data: { qualityStatus: pendingQualityStatus, qualityNotes: notes || null },
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/purchase/grn')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
      </Button>

      <PageHeader
        title={grn.grn_number}
        subtitle={`Vendor: ${grn.vendor_name ?? '—'} · Warehouse: ${grn.warehouse_name ?? '—'}`}
      />

      {/* Status + action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={grn.status} />

        {canPost && (
          <Button size="sm" onClick={() => setPostPreviewOpen(true)} disabled={postMutation.isPending}>
            {postMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Post GRN (commit stock)
          </Button>
        )}

        {grn.status === 'draft' && (
          <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={() => setDeleteOpen(true)} disabled={deleteMutation.isPending}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete GRN
          </Button>
        )}
      </div>

      {/* Linked PO banner */}
      {grn.purchase_order_id && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <Package className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Linked PO: </span>
            <button type="button"
              className="font-semibold text-blue-700 hover:underline inline-flex items-center gap-1"
              onClick={() => navigate(`/purchase/orders/${grn.purchase_order_id}`)}>
              {grn.po_number ?? grn.purchase_order_id}
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          <Button variant="outline" size="sm" className="text-blue-700 border-blue-200 hover:bg-blue-100"
            onClick={() => navigate(`/purchase/orders/${grn.purchase_order_id}`)}>
            View PO
          </Button>
        </div>
      )}

      {/* Receipt Details card */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">Receipt Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DetailField label="Receipt Date" value={fmt(grn.receipt_date ?? grn.received_date)} />
          <DetailField label="Invoice #" value={grn.invoice_number} />
          <DetailField label="Invoice Date" value={fmt(grn.invoice_date)} />
          <DetailField label="Vehicle #" value={grn.vehicle_number} />
          <DetailField label="Grand Total"
            value={
              <span className="text-base font-bold">
                ₹{Number(grn.grand_total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            }
          />
          {grn.notes && (
            <div className="col-span-2 md:col-span-3">
              <DetailField label="Notes" value={grn.notes} />
            </div>
          )}
        </div>
      </div>

      {/* Add Item panel */}
      {isEditable && (
        <AddItemPanel
          grnId={id}
          existingItems={grn.items ?? []}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['grn', id] });
            qc.invalidateQueries({ queryKey: ['grns'] });
          }}
        />
      )}

      {/* Items table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            GRN Items
            <span className="ml-2 text-muted-foreground font-normal">({grn.items?.length ?? 0})</span>
          </h3>
          {grn.purchase_order_id && (
            <span className="text-xs text-muted-foreground">Ordered vs Received from linked PO</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Product</th>
                <th className="px-4 py-2.5">Shade</th>
                {grn.purchase_order_id && <th className="px-4 py-2.5 text-right">Ordered</th>}
                <th className="px-4 py-2.5">Rack</th>
                <th className="px-4 py-2.5">Batch</th>
                <th className="px-4 py-2.5 text-right">Rcvd Boxes</th>
                <th className="px-4 py-2.5 text-right">Rcvd Pcs</th>
                <th className="px-4 py-2.5 text-right">Damaged</th>
                <th className="px-4 py-2.5 text-right">Unit Price</th>
                <th className="px-4 py-2.5 text-right">Line Total</th>
                <th className="px-4 py-2.5">Quality</th>
                <th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(grn.items ?? []).map((item: GRNItemFull) => {
                const rcvdBoxes = Number(item.received_boxes ?? 0);
                const rcvdPieces = Number(item.received_pieces ?? 0);
                const damaged = Number(item.damaged_boxes ?? 0);
                const netBoxes = Math.max(0, rcvdBoxes - damaged);
                const unitPrice = Number(item.unit_price ?? 0);
                const lineTotal = rcvdBoxes * unitPrice;
                const ordered = Number(item.ordered_boxes ?? 0);
                const isShort = grn.purchase_order_id && ordered > 0 && rcvdBoxes < ordered;

                return (
                  <tr key={item.id} className={cn("hover:bg-muted/10 transition-colors", damaged > 0 && "bg-destructive/5")}>
                    {/* Product */}
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.product_name ?? '—'}</p>
                      {item.product_code && (
                        <p className="text-xs text-muted-foreground">{item.product_code}</p>
                      )}
                    </td>

                    {/* Shade */}
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {item.shade_name ?? item.shade_code ?? '—'}
                    </td>

                    {/* Ordered (PO linked only) */}
                    {grn.purchase_order_id && (
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {ordered > 0 ? ordered : '—'}
                      </td>
                    )}

                    {/* Rack */}
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {item.rack_name ?? '—'}
                    </td>

                    {/* Batch */}
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {item.batch_number ?? '—'}
                    </td>

                    {/* Received boxes */}
                    <td className="px-4 py-3 text-right">
                      <span className={isShort ? 'text-amber-600 font-semibold' : 'font-medium'}>
                        {rcvdBoxes}
                      </span>
                      {isShort && (
                        <Badge variant="outline" className="ml-1.5 text-[9px] text-amber-600 border-amber-300 py-0">
                          short
                        </Badge>
                      )}
                      {damaged > 0 && (
                        <p className="text-[10px] text-green-700 mt-0.5">net {netBoxes} usable</p>
                      )}
                    </td>

                    {/* Received pieces */}
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {rcvdPieces > 0 ? rcvdPieces : '—'}
                    </td>

                    {/* Damaged */}
                    <td className="px-4 py-3 text-right">
                      {damaged > 0
                        ? <span className="text-destructive font-medium">{damaged}</span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>

                    {/* Unit price */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      ₹{unitPrice.toLocaleString('en-IN')}
                    </td>

                    {/* Line total */}
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Quality */}
                    <td className="px-4 py-3">
                      {isEditable && item.id ? (
                        <div className="flex items-center gap-1">
                          <Select
                            value={(item.quality_status as string) ?? 'pending'}
                            onValueChange={(v) => handleQualityChange(item, v)}
                          >
                            <SelectTrigger className="h-8 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {qualityOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Notes indicator */}
                          <Button
                            type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                            title={item.quality_notes ? 'Edit quality notes' : 'Add quality notes'}
                            onClick={() => {
                              setPendingQualityStatus((item.quality_status as string) ?? 'pending');
                              setQualityDialogItem({
                                itemId: item.id!,
                                status: (item.quality_status as string) ?? 'pending',
                                notes: item.quality_notes as string | null ?? null,
                              });
                            }}
                          >
                            <MessageSquare className={cn('h-3.5 w-3.5', item.quality_notes ? 'text-primary' : 'text-muted-foreground')} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={
                              (item as any).quality_status === 'pass' ? 'default' :
                                (item as any).quality_status === 'fail' ? 'destructive' : 'secondary'
                            }
                            className="capitalize text-xs"
                          >
                            {(item as any).quality_status ?? 'pending'}
                          </Badge>
                          {item.quality_notes && (
                            <span className="text-xs text-muted-foreground truncate max-w-[80px]" title={item.quality_notes as string}>
                              {item.quality_notes as string}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                          title="Print Label"
                          onClick={() => printLabelMutation.mutate(item.id!)}>
                          <Printer className="h-4 w-4" />
                        </Button>

                        {isEditable && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                              title="Edit Item"
                              onClick={() => setEditItemObj(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Delete Item"
                              onClick={() => setDeleteItemObj(item)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(!grn.items || grn.items.length === 0) && (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <Package className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No items on this GRN yet.</p>
            {isEditable && <p className="text-xs mt-1">Use the "Add Item" panel above to add items.</p>}
          </div>
        )}
      </div>

      {/* Grand total footer */}
      {(grn.items?.length ?? 0) > 0 && (
        <div className="flex justify-end">
          <div className="rounded-md border bg-muted/30 px-5 py-3 min-w-[240px] space-y-1.5">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Items</span>
              <span>{grn.items?.length ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Total Boxes</span>
              <span>{(grn.items ?? []).reduce((s, i) => s + Number((i as any).received_boxes ?? (i as any).received_qty_boxes ?? 0), 0)}</span>
            </div>
            {(grn.items ?? []).some((i) => Number((i as any).damaged_boxes ?? 0) > 0) && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Damaged Boxes</span>
                <span>{(grn.items ?? []).reduce((s, i) => s + Number((i as any).damaged_boxes ?? 0), 0)}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between text-sm font-bold">
              <span>Grand Total</span>
              <span>₹{Number(grn.grand_total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Post Preview Dialog */}
      <PostPreviewDialog
        grnItems={grn.items as GRNItemFull[] ?? []}
        open={postPreviewOpen}
        onClose={() => setPostPreviewOpen(false)}
        onConfirm={() => {
          setPostPreviewOpen(false);
          postMutation.mutate();
        }}
        loading={postMutation.isPending}
      />

      {/* Edit Item Dialog */}
      <EditItemDialog
        grnId={id}
        warehouseId={grn.warehouse_id}
        item={editItemObj}
        open={!!editItemObj}
        onClose={() => setEditItemObj(null)}
        onSuccess={() => {
          setEditItemObj(null);
          qc.invalidateQueries({ queryKey: ['grn', id] });
          qc.invalidateQueries({ queryKey: ['grns'] });
        }}
      />

      {/* Delete Item Confirmation Dialog */}
      <AlertDialog open={!!deleteItemObj} onOpenChange={(o) => !o && setDeleteItemObj(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteItemObj?.product_name} from this GRN?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteItemMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteItemMutation.mutate(deleteItemObj!.id!)}
              disabled={deleteItemMutation.isPending}
            >
              {deleteItemMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quality Notes Dialog */}
      <QualityNotesDialog
        open={!!qualityDialogItem}
        onClose={() => setQualityDialogItem(null)}
        onSave={handleQualityNoteSave}
        loading={updateQualityMutation.isPending}
        initialNotes={qualityDialogItem?.notes}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {grn.grn_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this draft GRN and all its items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete GRN'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}