import { useState, useEffect } from 'react';
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
import { LineItemsEditor, type LineItem } from '@/components/shared/LineItemsEditor';
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
  product_id: '',
  ordered_boxes: 1,
  unit_price: 0,
  discount_pct: 0,
  tax_pct: 18,
  line_total: 0,
});

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
  const [vendor_id, setVendorId] = useState('');
  const [warehouse_id, setWarehouseId] = useState('');
  const [order_date, setOrderDate] = useState('');
  const [expected_date, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setVendorId(initial.vendor_id);
      setWarehouseId(initial.warehouse_id);
      setOrderDate(initial.order_date ? initial.order_date.slice(0, 10) : '');
      setExpectedDate(initial.expected_date ? String(initial.expected_date).slice(0, 10) : '');
      setNotes(initial.notes || '');
      if (initial.items?.length) {
        setItems(
          initial.items.map((i) => ({
            product_id: i.product_id,
            ordered_boxes: Number(i.ordered_boxes) || 1,
            unit_price: Number(i.unit_price) || 0,
            discount_pct: Number(i.discount_pct) || 0,
            tax_pct: Number(i.tax_pct) || 18,
            line_total: Number(i.line_total) || 0,
          }))
        );
      } else {
        setItems([emptyLine()]);
      }
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setOrderDate(today);
      setExpectedDate('');
      setVendorId('');
      setWarehouseId('');
      setNotes('');
      setItems([emptyLine()]);
    }
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((i) => i.product_id && i.ordered_boxes > 0);
    if (!vendor_id || !warehouse_id || !order_date) return;
    if (validItems.length === 0) return;
    const payload: CreatePODto = {
      vendor_id,
      warehouse_id,
      order_date,
      expected_date: expected_date || null,
      notes: notes || null,
      items: validItems.map((i) => ({
        product_id: i.product_id,
        ordered_boxes: i.ordered_boxes,
        ordered_pieces: 0,
        unit_price: i.unit_price,
        discount_pct: i.discount_pct ?? 0,
        tax_pct: i.tax_pct ?? 18,
      })),
    };
    await onSubmit(payload);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Purchase Order' : 'New Purchase Order'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select value={vendor_id} onValueChange={setVendorId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Warehouse</Label>
              <Select value={warehouse_id} onValueChange={setWarehouseId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Order Date</Label>
              <Input
                type="date"
                value={order_date}
                onChange={(e) => setOrderDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Expected Date</Label>
              <Input
                type="date"
                value={expected_date}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <LineItemsEditor items={items} onChange={setItems} products={products} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : initial ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
