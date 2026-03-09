import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

export interface LineItem {
  id?: string;
  product_id: string;
  shade_id?: string | null;
  ordered_boxes: number;
  unit_price: number;
  discount_pct: number;
  tax_pct: number;
  line_total: number;
}

interface Product {
  id: string;
  code: string;
  name: string;
  mrp: number | null;
  gst_rate: number;
}

interface LineItemsEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  products: Product[];
  /** When true, line items are read-only (e.g. editing non-draft order) */
  readOnly?: boolean;
}

function calcLineTotal(item: LineItem): number {
  const base = item.ordered_boxes * item.unit_price;
  const afterDiscount = base * (1 - (item.discount_pct || 0) / 100);
  const afterTax = afterDiscount * (1 + (item.tax_pct || 0) / 100);
  return Math.round(afterTax * 100) / 100;
}

const emptyItem = (): LineItem => ({
  product_id: '',
  shade_id: null,
  ordered_boxes: 1,
  unit_price: 0,
  discount_pct: 0,
  tax_pct: 18,
  line_total: 0,
});

export function LineItemsEditor({ items, onChange, products, readOnly = false }: LineItemsEditorProps) {
  const updateItem = (index: number, patch: Partial<LineItem>) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const merged = { ...item, ...patch };
      merged.line_total = calcLineTotal(merged);
      return merged;
    });
    onChange(updated);
  };

  const addItem = () => onChange([...items, emptyItem()]);

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    updateItem(index, {
      product_id: productId,
      unit_price: product?.mrp ?? 0,
      tax_pct: product?.gst_rate ?? 18,
    });
  };

  const subTotal = items.reduce((sum, i) => {
    const base = i.ordered_boxes * i.unit_price;
    return sum + base * (1 - (i.discount_pct || 0) / 100);
  }, 0);
  const taxTotal = items.reduce((sum, i) => {
    const base = i.ordered_boxes * i.unit_price;
    const afterDiscount = base * (1 - (i.discount_pct || 0) / 100);
    return sum + afterDiscount * ((i.tax_pct || 0) / 100);
  }, 0);
  const grandTotal = items.reduce((sum, i) => sum + i.line_total, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Line Items</h4>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Add Item
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-xs text-muted-foreground uppercase">
                <th className="text-left px-3 py-2 font-medium w-[35%]">Product</th>
                <th className="text-right px-2 py-2 font-medium w-[10%]">Boxes</th>
                <th className="text-right px-2 py-2 font-medium w-[14%]">Unit Price</th>
                <th className="text-right px-2 py-2 font-medium w-[10%]">Disc %</th>
                <th className="text-right px-2 py-2 font-medium w-[10%]">Tax %</th>
                <th className="text-right px-2 py-2 font-medium w-[14%]">Total</th>
                <th className="w-[7%]"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="px-2 py-1.5">
                    <Select value={item.product_id || 'none'} onValueChange={v => !readOnly && v !== 'none' && handleProductSelect(idx, v)} disabled={readOnly}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select product..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.code} — {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      type="number"
                      min={1}
                      className="h-8 text-xs text-right w-full"
                      value={item.ordered_boxes}
                      onChange={e => !readOnly && updateItem(idx, { ordered_boxes: Math.max(1, Number(e.target.value) || 1) })}
                      readOnly={readOnly}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      type="number"
                      step="any"
                      className="h-8 text-xs text-right w-full"
                      value={item.unit_price}
                      onChange={e => !readOnly && updateItem(idx, { unit_price: Number(e.target.value) || 0 })}
                      readOnly={readOnly}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      type="number"
                      step="any"
                      className="h-8 text-xs text-right w-full"
                      value={item.discount_pct}
                      onChange={e => !readOnly && updateItem(idx, { discount_pct: Number(e.target.value) || 0 })}
                      readOnly={readOnly}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      type="number"
                      step="any"
                      className="h-8 text-xs text-right w-full"
                      value={item.tax_pct}
                      onChange={e => !readOnly && updateItem(idx, { tax_pct: Number(e.target.value) || 0 })}
                      readOnly={readOnly}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs font-medium text-foreground">
                    ₹{item.line_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-1 py-1.5">
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeItem(idx)}
                        disabled={items.length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t bg-muted/20 px-3 py-2 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Sub Total</span>
            <span>₹{subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Tax</span>
            <span>₹{taxTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-foreground pt-1 border-t border-border">
            <span>Grand Total</span>
            <span>₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
