import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { grnApi } from '@/api/grnApi';
import { vendorApi } from '@/api/vendorApi';
import { warehouseApi } from '@/api/warehouseApi';
import { purchaseOrderApi } from '@/api/miscApi';
import { productApi } from '@/api/productApi';
import type { GRN } from '@/types/grn.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  Eye, Pencil, Trash2, Plus, ExternalLink,
  ChevronsUpDown, Check, Package, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Local Types ──────────────────────────────────────────────────────────────
interface Product { id: string; name: string; code: string }
interface Shade { id: string; shade_code: string; shade_name: string }

interface GRNItemRow {
  _key: string;
  product_id: string;
  product_label: string;
  shade_id: string;
  shade_label: string;
  received_boxes: number;
  received_pieces: number;
  damaged_boxes: number;
  unit_price: number;
  ordered_boxes?: number;
}

// ─── ProductCombobox ──────────────────────────────────────────────────────────
// Searches products by name/code — no UUID entry needed by the user
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
          variant="outline" role="combobox" type="button"
          disabled={disabled}
          className={cn('w-full justify-between font-normal text-start h-9', !value && 'text-muted-foreground')}
        >
          <span className="truncate text-sm">{label || 'Search product…'}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type name or code…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty className="py-6 text-sm text-center text-muted-foreground">No products found.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onChange(p.id, `${p.code} · ${p.name}`);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <Check className={cn('me-2 h-4 w-4 shrink-0', value === p.id ? 'opacity-100' : 'opacity-0')} />
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

// ─── ShadeSelect ──────────────────────────────────────────────────────────────
function ShadeSelect({
  productId, value, onChange, disabled = false,
}: {
  productId: string; value: string;
  onChange: (id: string, label: string) => void;
  disabled?: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['shades-for-product', productId],
    queryFn: () => productApi.getShades(productId),
    enabled: !!productId,
  });
  const shades: Shade[] = data?.data ?? [];

  const placeholder = !productId
    ? 'Select product first'
    : isLoading
      ? 'Loading…'
      : shades.length === 0
        ? 'No shades available'
        : 'Select shade (optional)';

  return (
    <Select
      value={value || '__none__'}
      onValueChange={(v) => {
        if (v === '__none__') { onChange('', ''); return; }
        const s = shades.find((sh) => sh.id === v);
        onChange(v, s ? `${s.shade_code} · ${s.shade_name}` : v);
      }}
      disabled={disabled || !productId || shades.length === 0}
    >
      <SelectTrigger className="h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— No shade —</SelectItem>
        {shades.map((s) => (
          <SelectItem key={s.id} value={s.id}>{s.shade_code} · {s.shade_name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── ItemsEditor ──────────────────────────────────────────────────────────────
function ItemsEditor({ items, onChange }: { items: GRNItemRow[]; onChange: (items: GRNItemRow[]) => void }) {
  const { t } = useTranslation();
  const addRow = () =>
    onChange([...items, {
      _key: crypto.randomUUID(),
      product_id: '', product_label: '',
      shade_id: '', shade_label: '',
      received_boxes: 0, received_pieces: 0,
      damaged_boxes: 0, unit_price: 0,
    }]);

  const remove = (key: string) =>
    onChange(items.filter((i) => i._key !== key));

  const update = (key: string, patch: Partial<GRNItemRow>) =>
    onChange(items.map((i) => i._key === key ? { ...i, ...patch } : i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>
          {t('grn.lineItems')} <span className="text-destructive">*</span>
          <span className="ms-1.5 text-xs font-normal text-muted-foreground">({t('grn.noItems', 'at least 1 required')})</span>
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="me-1 h-3.5 w-3.5" /> {t('common.addLine')}
        </Button>
      </div>

      {items.length === 0 && (
        <div className="flex flex-col items-center py-8 rounded-md border border-dashed text-muted-foreground">
          <Package className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">{t('grn.noItems')}</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((row, idx) => (
          <div key={row._key} className="rounded-md border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('grn.product')} {idx + 1}</span>
              <Button
                type="button" variant="ghost" size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => remove(row._key)}
                disabled={items.length === 1}
                title={t('common.delete')}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Product search */}
            <div className="space-y-1">
              <Label className="text-xs">{t('grn.product')} <span className="text-destructive">*</span></Label>
              <ProductCombobox
                value={row.product_id}
                label={row.product_label}
                onChange={(id, lbl) => update(row._key, {
                  product_id: id, product_label: lbl,
                  shade_id: '', shade_label: '',
                })}
              />
            </div>

            {/* Row 1: Shade + Received Boxes + Unit Price */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('grn.rack', 'Shade')}</Label>
                <ShadeSelect
                  productId={row.product_id}
                  value={row.shade_id}
                  onChange={(id, lbl) => update(row._key, { shade_id: id, shade_label: lbl })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex justify-between">
                  <span>{t('grn.receivedBoxes')} <span className="text-destructive">*</span></span>
                  {row.ordered_boxes !== undefined && (
                    <span className="text-[10px] text-muted-foreground me-1">
                      {t('grn.orderedBoxes')}: {row.ordered_boxes}
                    </span>
                  )}
                </Label>
                <Input
                  type="number" min={0} step="0.01" className="h-9"
                  value={row.received_boxes}
                  onChange={(e) => update(row._key, { received_boxes: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('purchaseOrders.unitPrice')} (₹) <span className="text-destructive">*</span></Label>
                <Input
                  type="number" min={0} step="0.01" className="h-9"
                  value={row.unit_price}
                  onChange={(e) => update(row._key, { unit_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Row 2: Received Pieces + Damaged Boxes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  {t('grn.receivedPieces')}
                </Label>
                <Input
                  type="number" min={0} step="0.01" className="h-9"
                  value={row.received_pieces}
                  onChange={(e) => update(row._key, { received_pieces: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  {t('damageEntries.title', 'Damaged Boxes')}
                </Label>
                <Input
                  type="number" min={0} step="0.01" className="h-9"
                  value={row.damaged_boxes}
                  onChange={(e) => update(row._key, { damaged_boxes: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Create GRN Dialog ────────────────────────────────────────────────────────
function CreateGRNDialog({
  open, onClose, onSubmit, loading, preselectedPoId,
}: {
  open: boolean; onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => Promise<void>;
  loading: boolean; preselectedPoId?: string | null;
}) {
  const [po_id, setPoId] = useState('');
  const [vendor_id, setVendorId] = useState('');
  const [warehouse_id, setWarehouseId] = useState('');
  const [receipt_date, setReceiptDate] = useState('');
  const [invoice_number, setInvoiceNumber] = useState('');
  const [invoice_date, setInvoiceDate] = useState('');
  const [vehicle_number, setVehicleNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<GRNItemRow[]>([]);

  const { data: posData } = useQuery({
    queryKey: ['pos-for-grn'],
    queryFn: () => purchaseOrderApi.getAll({ limit: 500, sortBy: 'created_at', sortOrder: 'DESC' }),
    enabled: open,
    select: (d) => (d?.data ?? []).filter((p: { status: string }) => ['confirmed', 'partial'].includes(p.status)),
  });
  const availablePOs = posData ?? [];

  const { data: poDetails } = useQuery({
    queryKey: ['po-details', po_id],
    queryFn: () => purchaseOrderApi.getById(po_id),
    enabled: !!po_id,
  });

  const { data: vData } = useQuery({ queryKey: ['vendors', 500], queryFn: () => vendorApi.getAll({ limit: 500 }), enabled: open });
  const { data: wData } = useQuery({ queryKey: ['warehouses', 500], queryFn: () => warehouseApi.getAll({ limit: 500 }), enabled: open });
  const vendors = vData?.data ?? [];
  const warehouses = wData?.data ?? [];

  useEffect(() => {
    if (!open) return;
    setPoId(preselectedPoId ?? '');
    setReceiptDate(new Date().toISOString().slice(0, 10));
    setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setVehicleNumber(''); setNotes('');
    setVendorId(''); setWarehouseId('');
    setItems([{ _key: crypto.randomUUID(), product_id: '', product_label: '', shade_id: '', shade_label: '', received_boxes: 0, received_pieces: 0, damaged_boxes: 0, unit_price: 0 }]);
  }, [open, preselectedPoId]);

  // Auto-fill vendor/warehouse from selected PO
  useEffect(() => {
    if (!po_id) return;
    const po = availablePOs.find((p: { id: string; vendor_id?: string; warehouse_id?: string }) => p.id === po_id);
    if (po) { setVendorId(po.vendor_id ?? ''); setWarehouseId(po.warehouse_id ?? ''); }
  }, [po_id, availablePOs]);

  // Auto-fill items from selected PO
  useEffect(() => {
    if (!po_id) {
      if (items.some((it) => it.ordered_boxes !== undefined)) {
        setItems([{ _key: crypto.randomUUID(), product_id: '', product_label: '', shade_id: '', shade_label: '', received_boxes: 0, received_pieces: 0, damaged_boxes: 0, unit_price: 0 }]);
      }
      return;
    }
    if (poDetails?.data?.items) {
      const newItems = poDetails.data.items.map((item: any) => {
        const remaining = Math.max(0, (item.ordered_boxes || 0) - (item.received_boxes || 0));
        return {
          _key: crypto.randomUUID(),
          product_id: item.product_id,
          product_label: item.product_name || item.product_code || '',
          shade_id: item.shade_id || '',
          shade_label: item.shade_name || item.shade_code || '',
          received_boxes: remaining,
          received_pieces: 0,
          damaged_boxes: 0,
          unit_price: item.unit_price || 0,
          ordered_boxes: item.ordered_boxes,
        };
      });
      if (newItems.length > 0) {
        setItems(newItems);
      }
    }
  }, [po_id, poDetails?.data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor_id || !warehouse_id || !receipt_date) {
      toast.error('Vendor, warehouse and receipt date are required.');
      return;
    }
    if (items.some((it) => !it.product_id || it.received_boxes <= 0)) {
      toast.error('Each item needs a product and received boxes > 0.');
      return;
    }
    const productIds = new Set();
    for (const it of items) {
      if (!it.product_id) continue;
      if (productIds.has(it.product_id)) {
        toast.error("This product has already been added to the GRN");
        return;
      }
      productIds.add(it.product_id);
    }

    if (items.some((it) => it.damaged_boxes > it.received_boxes)) {
      toast.error("Damaged boxes cannot exceed received boxes");
      return;
    }

    if (po_id && poDetails?.data?.items) {
      const hasWarning = items.some(it => {
        const poItem = poDetails.data.items.find((pi: any) => pi.product_id === it.product_id);
        return poItem && it.received_boxes > poItem.ordered_boxes;
      });
      if (hasWarning) {
        toast.warning("Received boxes exceed ordered quantity for some products in the PO");
      }
    }
    await onSubmit({
      purchaseOrderId: po_id || undefined,
      vendorId: vendor_id,
      warehouseId: warehouse_id,
      receiptDate: receipt_date,
      invoiceNumber: invoice_number || undefined,
      invoiceDate: invoice_date || undefined,
      vehicleNumber: vehicle_number || undefined,
      notes: notes || undefined,
      items: items.map((it) => ({
        product_id: it.product_id,
        shade_id: it.shade_id || undefined,
        received_boxes: it.received_boxes,
        received_pieces: it.received_pieces,
        damaged_boxes: it.damaged_boxes,
        unit_price: it.unit_price,
      })),
    });
  };

  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('grn.newGRN')}</DialogTitle>
          <DialogDescription>{t('grn.lineItems')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* PO */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              {t('grn.purchaseOrder')}
              <Badge variant="secondary" className="text-[10px] px-1.5 font-normal">{t('racks.optional')}</Badge>
            </Label>
            <Select
              value={po_id || '__none__'}
              onValueChange={(v) => setPoId(v === '__none__' ? '' : v)}
              disabled={!!preselectedPoId}
            >
              <SelectTrigger><SelectValue placeholder={t('grn.purchaseOrder')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('common.none')}</SelectItem>
                {availablePOs.map((po: { id: string; po_number: string; vendor_name?: string }) => (
                  <SelectItem key={po.id} value={po.id}>
                    {po.po_number}{po.vendor_name ? ` · ${po.vendor_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('grn.vendor')} <span className="text-destructive">*</span></Label>
              <Select value={vendor_id} onValueChange={setVendorId} disabled={!!po_id}>
                <SelectTrigger><SelectValue placeholder={t('grn.vendor')} /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v: { id: string; name: string }) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('grn.warehouse')} <span className="text-destructive">*</span></Label>
              <Select value={warehouse_id} onValueChange={setWarehouseId} disabled={!!po_id}>
                <SelectTrigger><SelectValue placeholder={t('grn.warehouse')} /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w: { id: string; name: string }) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('grn.receiptDate')} <span className="text-destructive">*</span></Label>
              <Input type="date" value={receipt_date} onChange={(e) => setReceiptDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>{t('purchaseOrders.expectedDate')}</Label>
              <Input type="date" value={invoice_date} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                {t('grn.notes', 'Vendor Invoice #')}
                <Badge variant="secondary" className="text-[10px] px-1.5 font-normal">{t('racks.optional')}</Badge>
              </Label>
              <Input value={invoice_number} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2025-001" />
            </div>
            <div className="space-y-2">
              <Label>{t('purchaseReturns.vehicleNumber')}</Label>
              <Input value={vehicle_number} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. GJ01AB1234" />
            </div>
          </div>

          <Separator />

          <ItemsEditor items={items} onChange={setItems} />

          <div className="space-y-2">
            <Label>{t('grn.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('grn.notes')} rows={2} />
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-2 mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('grn.lineItems')}</span>
              <span className="font-semibold">{items.filter(it => it.product_id).length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('grn.receivedBoxes')}</span>
              <span className="font-semibold">{items.reduce((sum, it) => sum + (it.received_boxes || 0), 0)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="font-bold">{t('purchaseOrders.grandTotal')}</span>
              <span className="font-bold">₹{items.reduce((sum, it) => sum + ((it.received_boxes || 0) * (it.unit_price || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={loading}>{loading ? t('common.saving') : t('grn.addGRN')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit GRN Dialog ──────────────────────────────────────────────────────────
function EditGRNDialog({
  grn, open, onClose, onSubmit, loading,
}: {
  grn: GRN | null; open: boolean; onClose: () => void;
  onSubmit: (id: string, d: Record<string, unknown>) => Promise<void>;
  loading: boolean;
}) {
  const [receipt_date, setReceiptDate] = useState('');
  const [invoice_number, setInvoiceNumber] = useState('');
  const [invoice_date, setInvoiceDate] = useState('');
  const [vehicle_number, setVehicleNumber] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!grn || !open) return;
    setReceiptDate(grn.receipt_date ? String(grn.receipt_date).slice(0, 10) : '');
    setInvoiceNumber(grn.invoice_number ?? '');
    setInvoiceDate(grn.invoice_date ? String(grn.invoice_date).slice(0, 10) : '');
    setVehicleNumber((grn as GRN & { vehicle_number?: string }).vehicle_number ?? '');
    setNotes(grn.notes ?? '');
  }, [grn, open]);

  const editable = grn?.status === 'draft' || grn?.status === 'verified';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grn) return;
    await onSubmit(grn.id, {
      receipt_date: receipt_date || undefined,
      invoice_number: invoice_number || undefined,
      invoice_date: invoice_date || undefined,
      vehicle_number: vehicle_number || undefined,
      notes: notes || undefined,
    });
  };

  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('grn.editGRN')} {grn?.grn_number}</DialogTitle>
          <DialogDescription>
            {t('purchaseOrders.notes')}
          </DialogDescription>
        </DialogHeader>

        {!editable && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            {t('grn.status')}: <strong className="capitalize">{grn?.status}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('grn.receiptDate')}</Label>
              <Input type="date" value={receipt_date} onChange={(e) => setReceiptDate(e.target.value)} disabled={!editable} />
            </div>
            <div className="space-y-2">
              <Label>{t('purchaseOrders.expectedDate')}</Label>
              <Input type="date" value={invoice_date} onChange={(e) => setInvoiceDate(e.target.value)} disabled={!editable} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('grn.vendor')}</Label>
              <Input value={invoice_number} onChange={(e) => setInvoiceNumber(e.target.value)} disabled={!editable} />
            </div>
            <div className="space-y-2">
              <Label>{t('purchaseReturns.vehicleNumber')}</Label>
              <Input value={vehicle_number} onChange={(e) => setVehicleNumber(e.target.value)} disabled={!editable} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('grn.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={!editable} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={loading || !editable}>
              {loading ? t('common.saving') : t('common.saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── GRN Quick-View Sheet ─────────────────────────────────────────────────────
function GRNDetailSheet({ id, open, onClose }: { id: string | null; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['grn-detail', id],
    queryFn: () => grnApi.getById(id!),
    enabled: !!id && open,
    select: (d) => d.data,
  });
  const grn = data as (GRN & { items?: Array<Record<string, unknown>>; vehicle_number?: string }) | undefined;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-mono text-lg">{grn?.grn_number ?? 'Loading…'}</SheetTitle>
          <SheetDescription asChild>
            <div>{grn && <StatusBadge status={grn.status} />}</div>
          </SheetDescription>
        </SheetHeader>

        {isLoading && <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>}

        {grn && (
          <div className="space-y-5">
            {/* Header grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {([
                [t('grn.vendor'), grn.vendor_name],
                [t('grn.warehouse'), grn.warehouse_name],
                ['PO #', grn.po_number ?? '—'],
                [t('grn.receiptDate'), grn.receipt_date ? new Date(String(grn.receipt_date)).toLocaleDateString('en-IN') : '—'],
                [t('grn.grnNumber'), grn.invoice_number ?? '—'],
                [t('grn.receiptDate'), grn.invoice_date ? new Date(String(grn.invoice_date)).toLocaleDateString('en-IN') : '—'],
                [t('purchaseReturns.vehicleNumber'), grn.vehicle_number ?? '—'],
                [t('purchaseOrders.grandTotal'), grn.grand_total != null ? `₹${Number(grn.grand_total).toLocaleString('en-IN')}` : '—'],
              ] as [string, string | null | undefined][]).map(([k, v]) => (
                <div key={k}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</p>
                  <p className="mt-0.5 font-medium">{v ?? '—'}</p>
                </div>
              ))}
              {grn.notes && (
                <div className="col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('grn.notes')}</p>
                  <p className="mt-0.5">{grn.notes}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Items */}
            <div>
              <p className="text-sm font-semibold mb-3">
                {t('grn.lineItems')} <span className="text-muted-foreground font-normal">({grn.items?.length ?? 0})</span>
              </p>
              {!grn.items?.length ? (
                <p className="text-sm text-muted-foreground">{t('grn.noItems')}</p>
              ) : (
                <div className="space-y-2">
                  {grn.items.map((item, i) => (
                    <div key={String(item.id ?? i)} className="rounded-md border p-3 text-sm space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{String(item.product_name ?? '—')}</p>
                          <p className="text-xs text-muted-foreground">
                            {String(item.product_code ?? '')}
                            {item.shade_name ? ` · ${item.shade_name}` : ''}
                          </p>
                        </div>
                        <Badge
                          variant={
                            item.quality_status === 'pass' ? 'default' :
                              item.quality_status === 'fail' ? 'destructive' : 'secondary'
                          }
                          className="ms-2 shrink-0"
                        >
                          {String(item.quality_status ?? t('common.pending'))}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <span>{t('grn.receivedBoxes')}: <strong className="text-foreground">{String(item.received_boxes)}</strong></span>
                        <span>{t('damageEntries.title', 'Damaged')}: <strong className="text-foreground">{String(item.damaged_boxes ?? 0)}</strong></span>
                        <span>₹<strong className="text-foreground">{Number(item.unit_price).toLocaleString('en-IN')}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <Button
              className="w-full"
              variant="outline"
              onClick={() => { onClose(); navigate(`/purchase/grn/${grn.id}`); }}
            >
              <ExternalLink className="me-2 h-4 w-4" />
              {t('common.view')}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Delete Confirmation ──────────────────────────────────────────────────────
function DeleteGRNDialog({
  grn, open, onClose, onConfirm, loading,
}: {
  grn: GRN | null; open: boolean; onClose: () => void;
  onConfirm: () => Promise<void>; loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('grn.grnNumber')} {grn?.grn_number}?</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteDialog.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? t('common.deleting') : t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main GRN Page
// ═════════════════════════════════════════════════════════════════════════════
export default function GRNPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPoId = searchParams.get('po_id');

  const [createOpen, setCreateOpen] = useState(false);
  const [editGRN, setEditGRN] = useState<GRN | null>(null);
  const [deleteGRN, setDeleteGRN] = useState<GRN | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(value); setPage(1); }, 400);
  }, []);

  useEffect(() => { if (preselectedPoId) setCreateOpen(true); }, [preselectedPoId]);

  const listParams = {
    page, limit: 25,
    search: search.trim() || undefined,
    sortBy: 'created_at',
    sortOrder: 'DESC' as const,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['grns', listParams],
    queryFn: () => grnApi.getAll(listParams),
  });
  const grns: GRN[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (fd: Record<string, unknown>) =>
      grnApi.create({
        purchaseOrderId: fd.purchaseOrderId ? String(fd.purchaseOrderId) : undefined,
        vendorId: String(fd.vendorId),
        warehouseId: String(fd.warehouseId),
        receiptDate: String(fd.receiptDate),
        invoiceNumber: fd.invoiceNumber ? String(fd.invoiceNumber) : undefined,
        invoiceDate: fd.invoiceDate ? String(fd.invoiceDate) : undefined,
        vehicleNumber: fd.vehicleNumber ? String(fd.vehicleNumber) : undefined,
        notes: fd.notes ? String(fd.notes) : undefined,
        items: fd.items as Parameters<typeof grnApi.create>[0]['items'],
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['grns'] });
      setCreateOpen(false);
      toast.success('GRN created');
      const newId = (res as { data?: { id?: string } })?.data?.id;
      if (newId) navigate(`/purchase/grn/${newId}`);
    },
    onError: (e: any) => {
      console.error('Validation Error Details:', e?.response?.data?.error?.details || e?.response?.data);
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Create failed');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: Record<string, unknown> }) =>
      grnApi.update(id, d as Parameters<typeof grnApi.update>[1]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grns'] });
      qc.invalidateQueries({ queryKey: ['grn-detail'] });
      setEditGRN(null);
      toast.success('GRN updated');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => grnApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grns'] });
      setDeleteGRN(null);
      toast.success('GRN deleted');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed'),
  });

  // ─── Columns ───────────────────────────────────────────────────────────────
  const { t } = useTranslation();

  const columns = [
    {
      key: 'grn_number',
      label: t('grn.grnNumber'),
      render: (r: GRN) => (
        <button type="button"
          className="font-mono text-sm font-semibold text-primary hover:underline whitespace-nowrap"
          onClick={() => setViewId(r.id)}>
          {r.grn_number}
        </button>
      ),
    },
    {
      key: 'po_number',
      label: t('grn.purchaseOrder'),
      render: (r: GRN) =>
        r.po_number
          ? <button type="button"
            className="font-mono text-xs text-blue-600 hover:underline whitespace-nowrap"
            onClick={() => navigate(`/purchase/orders/${r.purchase_order_id}`)}>
            {r.po_number}
          </button>
          : <span className="text-muted-foreground text-xs">—</span>,
    },
    { key: 'vendor_name', label: t('grn.vendor'), render: (r: GRN) => <span className="text-sm">{r.vendor_name ?? '—'}</span> },
    { key: 'warehouse_name', label: t('grn.warehouse'), render: (r: GRN) => <span className="text-sm">{r.warehouse_name ?? '—'}</span> },
    { key: 'status', label: t('grn.status'), render: (r: GRN) => <StatusBadge status={r.status} /> },
    {
      key: 'receipt_date',
      label: t('grn.receiptDate'),
      render: (r: GRN) => {
        const d = r.receipt_date ?? r.received_date;
        return <span className="text-sm whitespace-nowrap">{d ? new Date(String(d)).toLocaleDateString('en-IN') : '—'}</span>;
      },
    },
    {
      key: 'grand_total',
      label: t('common.total'),
      render: (r: GRN) => (
        <span className="text-sm font-medium whitespace-nowrap">
          {r.grand_total != null ? `₹${Number(r.grand_total).toLocaleString('en-IN')}` : '—'}
        </span>
      ),
    },
    {
      key: 'invoice_number',
      label: t('grn.grnNumber'),
      render: (r: GRN) => <span className="text-sm">{r.invoice_number ?? '—'}</span>,
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (r: GRN) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.view')}
            onClick={() => setViewId(r.id)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.edit')}
            onClick={() => setEditGRN(r)}
            disabled={r.status === 'posted'}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive disabled:opacity-30"
            title={t('common.delete')}
            onClick={() => setDeleteGRN(r)}
            disabled={r.status !== 'draft'}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('grn.title')}
        subtitle={t('grn.subtitle')}
        onAdd={() => setCreateOpen(true)}
        addLabel={t('grn.addGRN')}
      />

      <DataTableShell<GRN>
        data={grns}
        columns={columns}
        searchKey="grn_number"
        searchPlaceholder={t('common.search')}
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      <CreateGRNDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(d) => createMutation.mutateAsync(d)}
        loading={createMutation.isPending}
        preselectedPoId={preselectedPoId}
      />

      <EditGRNDialog
        grn={editGRN}
        open={!!editGRN}
        onClose={() => setEditGRN(null)}
        onSubmit={(id, d) => updateMutation.mutateAsync({ id, data: d })}
        loading={updateMutation.isPending}
      />

      <GRNDetailSheet
        id={viewId}
        open={!!viewId}
        onClose={() => setViewId(null)}
      />

      <DeleteGRNDialog
        grn={deleteGRN}
        open={!!deleteGRN}
        onClose={() => setDeleteGRN(null)}
        onConfirm={() => deleteMutation.mutateAsync(deleteGRN!.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}