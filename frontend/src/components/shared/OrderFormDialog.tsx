import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { fetchNextDocNumber } from '@/hooks/useNextDocNumber';
import { LineItemsEditor, LineItem } from '@/components/shared/LineItemsEditor';
import { FieldDef } from '@/components/shared/CrudFormDialog';

interface Product {
  id: string;
  code: string;
  name: string;
  mrp: number | null;
  gst_rate: number;
}

interface OrderFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (headerData: Record<string, any>, lineItems: LineItem[]) => Promise<void>;
  headerFields: FieldDef[];
  title: string;
  initialData?: Record<string, any> | null;
  initialItems?: LineItem[];
  loading?: boolean;
  autoNumber?: { fieldKey: string; docType: string };
  products: Product[];
}

const emptyItem = (): LineItem => ({
  product_id: '',
  ordered_boxes: 1,
  unit_price: 0,
  discount_pct: 0,
  tax_pct: 18,
  line_total: 0,
});

export function OrderFormDialog({
  open, onClose, onSubmit, headerFields, title, initialData, initialItems, loading, autoNumber, products,
}: OrderFormDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyItem()]);

  useEffect(() => {
    if (open) {
      const defaults: Record<string, any> = {};
      headerFields.forEach(f => {
        if (f.type === 'select' && !f.required) {
          defaults[f.key] = initialData?.[f.key] || f.defaultValue || 'none';
        } else {
          defaults[f.key] = initialData?.[f.key] ?? f.defaultValue ?? (f.type === 'number' ? '' : '');
        }
      });
      setFormData(defaults);
      setLineItems(initialItems && initialItems.length > 0 ? initialItems : [emptyItem()]);

      if (!initialData && autoNumber) {
        fetchNextDocNumber(autoNumber.docType)
          .then(num => setFormData(prev => ({ ...prev, [autoNumber.fieldKey]: num })))
          .catch(() => {});
      }
    }
  }, [open, initialData, initialItems, headerFields, autoNumber]);

  // Auto-calculate totals from line items
  useEffect(() => {
    const subTotal = lineItems.reduce((sum, i) => {
      const base = i.ordered_boxes * i.unit_price;
      return sum + base * (1 - (i.discount_pct || 0) / 100);
    }, 0);
    const taxTotal = lineItems.reduce((sum, i) => {
      const base = i.ordered_boxes * i.unit_price;
      const afterDiscount = base * (1 - (i.discount_pct || 0) / 100);
      return sum + afterDiscount * ((i.tax_pct || 0) / 100);
    }, 0);
    const grandTotal = lineItems.reduce((sum, i) => sum + i.line_total, 0);

    setFormData(prev => ({
      ...prev,
      total_amount: Math.round(subTotal * 100) / 100,
      sub_total: Math.round(subTotal * 100) / 100,
      tax_amount: Math.round(taxTotal * 100) / 100,
      grand_total: Math.round(grandTotal * 100) / 100,
    }));
  }, [lineItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const requiredHeaderKeys = headerFields.filter(f => f.required).map(f => f.key);
    const missing = requiredHeaderKeys.filter(k => {
      const v = formData[k];
      return v === undefined || v === null || v === '' || (formData[k] === 'none');
    });
    if (missing.length) {
      const labels = missing.map(k => headerFields.find(f => f.key === k)?.label ?? k).join(', ');
      toast.error(`Required: ${labels}`);
      return;
    }
    const validItems = lineItems.filter(i => i.product_id);
    if (validItems.length === 0) {
      toast.error('Add at least one line item with a product');
      return;
    }
    const submitData: Record<string, any> = {};
    for (const key in formData) {
      submitData[key] = formData[key] === 'none' ? '' : formData[key];
    }
    try {
      await onSubmit(submitData, validItems);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Request failed';
      toast.error(msg);
    }
  };

  const setValue = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));
  const isAutoNumberField = (key: string) => !initialData && autoNumber?.fieldKey === key;
  const isCalculatedField = (key: string) => ['total_amount', 'sub_total', 'tax_amount', 'grand_total'].includes(key);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Header fields in grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {headerFields.filter(f => !isCalculatedField(f.key)).map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key} className="text-xs">{f.label}</Label>
                {f.type === 'textarea' ? (
                  <Textarea id={f.key} value={formData[f.key] || ''} onChange={e => setValue(f.key, e.target.value)} placeholder={f.placeholder} className="text-sm" />
                ) : f.type === 'select' ? (
                  <Select value={formData[f.key] || 'none'} onValueChange={v => setValue(f.key, v)}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {!f.required && <SelectItem value="none">— None —</SelectItem>}
                      {f.options?.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={f.key}
                    type={f.type}
                    value={formData[f.key] ?? ''}
                    onChange={e => setValue(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    step={f.type === 'number' ? 'any' : undefined}
                    readOnly={isAutoNumberField(f.key)}
                    className={`text-sm ${isAutoNumberField(f.key) ? 'bg-muted font-mono' : ''}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Line Items */}
          <LineItemsEditor items={lineItems} onChange={setLineItems} products={products} readOnly={Boolean(initialData?.status && initialData.status !== 'draft')} />

          {/* Notes (if present) */}
          {headerFields.find(f => f.key === 'notes' && f.type === 'textarea') && (
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs">Notes</Label>
              <Textarea id="notes" value={formData.notes || ''} onChange={e => setValue('notes', e.target.value)} placeholder="Optional notes..." className="text-sm" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : initialData ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
