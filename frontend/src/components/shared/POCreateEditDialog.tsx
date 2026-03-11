import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { AlertTriangle } from 'lucide-react';
import { LineItemsEditor, type LineItem, type Shade } from '@/components/shared/LineItemsEditor';
import { shadeApi } from '@/api/warehouseApi';
import type { PurchaseOrder, CreatePODto } from '@/types/misc.types';

interface Product {
  id: string;
  code: string;
  name: string;
  mrp: number | null;
  gst_rate: number;
}

interface POCreateEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreatePODto) => Promise<void>;
  loading: boolean;
  vendors: { value: string; label: string }[];
  warehouses: { value: string; label: string }[];
  products: Product[];
  initial?: PurchaseOrder | null;
}

const emptyLine = (): LineItem => ({
  product_id:    '',
  shade_id:      null,
  ordered_boxes: 1,
  unit_price:    0,
  discount_pct:  0,
  tax_pct:       18,
  line_total:    0,
});

// ─── Helper: single totals row ────────────────────────────────────────────────
function TotalRow({
  label,
  value,
  bold = false,
  negative = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
  negative?: boolean;
}) {
  const formatted = value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <div
      className={`flex justify-between text-sm ${
        bold
          ? 'font-semibold text-base border-t pt-2 mt-1'
          : 'text-muted-foreground'
      }`}
    >
      <span>{label}</span>
      <span className={negative && value > 0 ? 'text-red-600' : ''}>
        {negative && value > 0 ? '−' : ''}₹{formatted}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function POCreateEditDialog({
  open,
  onClose,
  onSubmit,
  loading,
  vendors,
  warehouses,
  products,
  initial,
}: POCreateEditDialogProps) {
  // Header fields
  const [vendor_id,          setVendorId]          = useState('');
  const [warehouse_id,       setWarehouseId]        = useState('');
  const [order_date,         setOrderDate]          = useState('');
  const [expected_date,      setExpectedDate]       = useState('');
  const [received_date,      setReceivedDate]       = useState('');
  // FIX #2 — state name kept as `additionalDiscount` to avoid confusion with
  //           `discount_amount` which is a CALCULATED field returned by the API
  const [additionalDiscount, setAdditionalDiscount] = useState('0');
  const [notes,              setNotes]              = useState('');
  const [items,              setItems]              = useState<LineItem[]>([emptyLine()]);

  const isEditMode  = !!initial;
  const isDraft     = !initial || initial.status === 'draft';
  // limitedEdit: PO exists but is no longer a draft — only received_date + notes can be saved
  const limitedEdit = isEditMode && !isDraft;

  // Fetch shades
  const { data: shadesData } = useQuery({
    queryKey: ['shades', { limit: 1000 }],
    queryFn:  () => shadeApi.getAll({ limit: 1000 }),
    enabled:  open,
    staleTime: 5 * 60 * 1000,
  });

  const shades: Shade[] = (shadesData?.data ?? []).map((s) => ({
    id:         s.id,
    product_id: s.product_id,
    shade_code: s.shade_code,
    shade_name: s.shade_name ?? null,
    hex_color:  s.hex_color  ?? null,
  }));

  // Populate form on open
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setVendorId(initial.vendor_id);
      setWarehouseId(initial.warehouse_id);
      setOrderDate(initial.order_date ? initial.order_date.slice(0, 10) : '');
      setExpectedDate(initial.expected_date ? String(initial.expected_date).slice(0, 10) : '');
      setReceivedDate(initial.received_date ? String(initial.received_date).slice(0, 10) : '');
      // FIX #2 — read from additional_discount, not discount_amount
      // discount_amount is the calculated sum of per-item discounts (not user input)
      setAdditionalDiscount(String((initial as any).additional_discount ?? '0'));
      setNotes(initial.notes || '');
      setItems(
        initial.items?.length
          ? initial.items.map((i) => ({
              product_id:     i.product_id,
              shade_id:       i.shade_id       ?? null,
              ordered_boxes:  Number(i.ordered_boxes)  || 1,
              ordered_pieces: Number(i.ordered_pieces) || 0,
              unit_price:     Number(i.unit_price)     || 0,
              discount_pct:   Number(i.discount_pct)   || 0,
              tax_pct:        Number(i.tax_pct)         || 18,
              line_total:     Number(i.line_total)      || 0,
            }))
          : [emptyLine()]
      );
    } else {
      setOrderDate(new Date().toISOString().slice(0, 10));
      setExpectedDate('');
      setReceivedDate('');
      setAdditionalDiscount('0');
      setVendorId('');
      setWarehouseId('');
      setNotes('');
      setItems([emptyLine()]);
    }
  }, [open, initial]);

  // ─── Live totals — aligned exactly with backend calculation ───────────────
  // FIX #6 — backend logic:
  //   line_total   = boxes * price * (1 - disc_pct/100) * (1 + tax_pct/100)
  //   discount_amt = sum of (boxes * price * disc_pct/100)          per item
  //   tax_amt      = sum of (boxes * price * (1-disc%) * tax_pct/100) per item
  //   grand_total  = sum(line_totals) - additional_discount
  const totals = useMemo(() => {
    const valid = items.filter((i) => i.product_id && i.ordered_boxes > 0);

    const sub_total = valid.reduce(
      (acc, i) => acc + i.ordered_boxes * i.unit_price,
      0
    );

    const line_discount = valid.reduce((acc, i) => {
      const base = i.ordered_boxes * i.unit_price;
      return acc + base * ((i.discount_pct ?? 0) / 100);
    }, 0);

    // Tax is applied per-item AFTER per-item discount only.
    // Backend does NOT include additional_discount when computing tax_amount.
    const tax_total = valid.reduce((acc, i) => {
      const base         = i.ordered_boxes * i.unit_price;
      const after_disc   = base * (1 - (i.discount_pct ?? 0) / 100);
      return acc + after_disc * ((i.tax_pct ?? 0) / 100);
    }, 0);

    const header_discount = Math.max(0, parseFloat(additionalDiscount) || 0);

    // sum of line totals = sub_total - line_discount + tax_total
    const line_totals_sum = sub_total - line_discount + tax_total;
    const grand_total     = Math.max(0, line_totals_sum - header_discount);

    return { sub_total, line_discount, tax_total, header_discount, grand_total };
  }, [items, additionalDiscount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // FIX #4 — limitedEdit path: only send received_date and notes via PUT /:id
    // Backend update() for non-draft accepts only ['received_date', 'notes']
    if (limitedEdit) {
      await onSubmit({
        received_date: received_date || null,
        notes:         notes         || null,
      } as CreatePODto);
      onClose();
      return;
    }

    const validItems = items.filter((i) => i.product_id && i.ordered_boxes > 0);
    if (!vendor_id || !warehouse_id || !order_date || validItems.length === 0) return;

    const payload: CreatePODto = {
      vendor_id,
      warehouse_id,
      order_date,
      expected_date:       expected_date || null,
      // FIX #3 — received_date excluded from create/draft-update payload.
      //           Creating a PO must not set received_date (backend schema rejects it).
      //           For draft updates, backend strips it via stripUnknown anyway.
      //           received_date is only set via the limitedEdit path above (non-draft).
      notes:               notes         || null,
      // FIX #1 — correct field name: additional_discount (not discount_amount)
      additional_discount: parseFloat(additionalDiscount) || 0,
      items: validItems.map((i) => ({
        product_id:     i.product_id,
        shade_id:       i.shade_id      ?? null,
        ordered_boxes:  i.ordered_boxes,
        ordered_pieces: i.ordered_pieces ?? 0,
        unit_price:     i.unit_price,
        discount_pct:   i.discount_pct  ?? 0,
        tax_pct:        i.tax_pct        ?? 18,
      })),
    };
    await onSubmit(payload);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {limitedEdit
              ? `Purchase Order — ${initial?.po_number} (edit received date / notes)`
              : initial
              ? 'Edit Purchase Order'
              : 'New Purchase Order'}
          </DialogTitle>
        </DialogHeader>

        {/* Banner for non-draft POs */}
        {limitedEdit && (
          <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            This PO is <strong className="mx-1">{initial?.status}</strong>. You can only edit
            <strong className="mx-1">Received Date</strong> and <strong>Notes</strong>.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Vendor + Warehouse ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Vendor <span className="text-destructive">*</span>
              </Label>
              <Select value={vendor_id} onValueChange={setVendorId} disabled={limitedEdit} required>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Warehouse <span className="text-destructive">*</span>
              </Label>
              <Select value={warehouse_id} onValueChange={setWarehouseId} disabled={limitedEdit} required>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Order Date + Expected Date ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Order Date <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={order_date}
                onChange={(e) => setOrderDate(e.target.value)}
                disabled={limitedEdit}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Expected Date</Label>
              <Input
                type="date"
                value={expected_date}
                onChange={(e) => setExpectedDate(e.target.value)}
                disabled={limitedEdit}
              />
            </div>
          </div>

          {/* ── Received Date + Additional Discount ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Received Date
                {/* FIX #5 — disabled during creation (no initial) AND during draft editing.
                    Per spec: "During order creation → received date must be disabled.
                               Only editable when receiving items (i.e. non-draft)."
                    For non-draft the limitedEdit path is active so the field IS enabled there. */}
                {!limitedEdit && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground uppercase tracking-wide">
                    set automatically via GRN
                  </span>
                )}
              </Label>
              <Input
                type="date"
                value={received_date}
                onChange={(e) => setReceivedDate(e.target.value)}
                // FIX #5 — disabled when creating new PO (!isEditMode) OR editing a draft
                // Only enabled when limitedEdit=true (i.e. PO is confirmed/partial/received)
                disabled={!limitedEdit}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Additional Discount (₹)
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground uppercase tracking-wide">
                  header level
                </span>
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={additionalDiscount}
                onChange={(e) => setAdditionalDiscount(e.target.value)}
                disabled={limitedEdit}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
              rows={2}
            />
          </div>

          {/* ── Line Items (read-only for non-draft) ── */}
          <LineItemsEditor
            items={items}
            onChange={setItems}
            products={products}
            shades={shades}
            readOnly={limitedEdit}
          />

          {/* ── Live totals summary ── */}
          <div className="flex justify-end">
            <div className="rounded-md border bg-muted/30 px-5 py-3 space-y-1 min-w-[280px]">
              <TotalRow label="Sub Total"             value={totals.sub_total} />
              {totals.line_discount > 0 && (
                <TotalRow label="Item Discount"       value={totals.line_discount}   negative />
              )}
              <TotalRow label="Tax (GST)"             value={totals.tax_total} />
              {totals.header_discount > 0 && (
                <TotalRow label="Additional Discount" value={totals.header_discount} negative />
              )}
              <TotalRow label="Grand Total"           value={totals.grand_total} bold />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : initial ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
