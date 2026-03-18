import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LineItem {
  id?: string;
  product_id: string;
  product_name?: string;
  shade_id?: string | null;
  ordered_boxes: number;
  ordered_pieces?: number;
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

export interface Shade {
  id: string;
  product_id: string;
  shade_code: string;
  shade_name: string | null;
  hex_color: string | null;
}

interface LineItemsEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  products: Product[];
  shades?: Shade[];
  /** When true, line items are read-only (e.g. editing non-draft order) */
  readOnly?: boolean;
}

function calcLineTotal(item: LineItem): number {
  const base         = item.ordered_boxes * item.unit_price;
  const afterDiscount = base * (1 - (item.discount_pct || 0) / 100);
  const afterTax      = afterDiscount * (1 + (item.tax_pct || 0) / 100);
  return Math.round(afterTax * 100) / 100;
}

const emptyItem = (): LineItem => ({
  product_id:    '',
  product_name:  '',
  shade_id:      null,
  ordered_boxes: 1,
  unit_price:    0,
  discount_pct:  0,
  tax_pct:       18,
  line_total:    0,
});

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LineItemsEditor({
  items,
  onChange,
  products,
  shades = [],
  readOnly = false,
}: LineItemsEditorProps) {

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const merged = { ...item, ...patch };
      merged.line_total = calcLineTotal(merged);
      return merged;
    });
    onChange(updated);
  };

  const addItem    = () => onChange([...items, emptyItem()]);
  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, product: Product | string) => {
    if (typeof product === 'string') {
      updateItem(index, {
        product_id: '',
        product_name: product,
      });
    } else {
      updateItem(index, {
        product_id: product.id,
        product_name: product.name,
        shade_id: null,
        unit_price: product.mrp ?? 0,
        tax_pct: product.gst_rate ?? 18,
      });
    }
  };

  // Summary
  const subTotal = items.reduce((sum, i) => {
    const base = i.ordered_boxes * i.unit_price;
    return sum + base * (1 - (i.discount_pct || 0) / 100);
  }, 0);
  const taxTotal = items.reduce((sum, i) => {
    const base         = i.ordered_boxes * i.unit_price;
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
                <th className="text-left px-3 py-2 font-medium w-[23%]">Product</th>
                <th className="text-left px-2 py-2 font-medium w-[15%]">Shade</th>
                <th className="text-right px-2 py-2 font-medium w-[8%]">Pcs/Box</th>
                <th className="text-right px-2 py-2 font-medium w-[8%]">Boxes</th>
                <th className="text-right px-2 py-2 font-medium w-[12%]">Unit Price</th>
                <th className="text-right px-2 py-2 font-medium w-[8%]">Disc %</th>
                <th className="text-right px-2 py-2 font-medium w-[8%]">Tax %</th>
                <th className="text-right px-2 py-2 font-medium w-[12%]">Total</th>
                <th className="w-[5%]"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                // Shades available for the currently selected product
                const productShades = shades.filter((s) => s.product_id === item.product_id);

                return (
                  <tr key={idx} className="border-t border-border">

                    {/* Product */}
                    <td className="px-2 py-1.5">
                      <ProductCombobox
                        products={products}
                        value={item.product_id || item.product_name || ''}
                        onChange={(p) => handleProductChange(idx, p)}
                        disabled={readOnly}
                      />
                    </td>

                    {/* Shade */}
                    <td className="px-2 py-1.5">
                      {productShades.length > 0 ? (
                        <Select
                          value={item.shade_id ?? '__none__'}
                          onValueChange={(v) =>
                            !readOnly && updateItem(idx, { shade_id: v === '__none__' ? null : v })
                          }
                          disabled={readOnly || !item.product_id}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="No shade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" className="text-xs text-muted-foreground">
                              No shade
                            </SelectItem>
                            {productShades.map((s) => (
                              <SelectItem key={s.id} value={s.id} className="text-xs">
                                <div className="flex items-center gap-1.5">
                                  {s.hex_color && (
                                    <span
                                      className="inline-block h-3 w-3 rounded-full border border-border shrink-0"
                                      style={{ backgroundColor: s.hex_color }}
                                    />
                                  )}
                                  {s.shade_code}
                                  {s.shade_name && (
                                    <span className="text-muted-foreground">— {s.shade_name}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="px-2 text-xs text-muted-foreground">
                          {item.product_id ? 'No shades' : '—'}
                        </span>
                      )}
                    </td>

                    {/* Pcs per Box */}
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        min={1}
                        className="h-8 text-xs text-right w-full"
                        value={item.ordered_pieces || ''}
                        placeholder="Pcs"
                        onChange={(e) =>
                          !readOnly &&
                          updateItem(idx, { ordered_pieces: Math.max(1, Number(e.target.value) || 1) })
                        }
                        readOnly={readOnly || !item.product_id}
                      />
                    </td>

                    {/* Boxes */}
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        min={1}
                        className="h-8 text-xs text-right w-full"
                        value={item.ordered_boxes}
                        onChange={(e) =>
                          !readOnly &&
                          updateItem(idx, { ordered_boxes: Math.max(1, Number(e.target.value) || 1) })
                        }
                        readOnly={readOnly}
                      />
                    </td>

                    {/* Unit Price */}
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        step="any"
                        className="h-8 text-xs text-right w-full"
                        value={item.unit_price}
                        onChange={(e) =>
                          !readOnly && updateItem(idx, { unit_price: Number(e.target.value) || 0 })
                        }
                        readOnly={readOnly}
                      />
                    </td>

                    {/* Disc % */}
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        step="any"
                        className="h-8 text-xs text-right w-full"
                        value={item.discount_pct}
                        onChange={(e) =>
                          !readOnly && updateItem(idx, { discount_pct: Number(e.target.value) || 0 })
                        }
                        readOnly={readOnly}
                      />
                    </td>

                    {/* Tax % */}
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        step="any"
                        className="h-8 text-xs text-right w-full"
                        value={item.tax_pct}
                        onChange={(e) =>
                          !readOnly && updateItem(idx, { tax_pct: Number(e.target.value) || 0 })
                        }
                        readOnly={readOnly}
                      />
                    </td>

                    {/* Line Total */}
                    <td className="px-2 py-1.5 text-right text-xs font-medium text-foreground">
                      ₹{fmt(item.line_total)}
                    </td>

                    {/* Remove */}
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
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t bg-muted/20 px-3 py-2 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Sub Total</span>
            <span>₹{fmt(subTotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Tax</span>
            <span>₹{fmt(taxTotal)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-foreground pt-1 border-t border-border">
            <span>Grand Total</span>
            <span>₹{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProductComboboxProps {
  products: Product[];
  value: string;
  onChange: (val: Product | string) => void;
  disabled?: boolean;
}

function ProductCombobox({ products, value, onChange, disabled }: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedProduct = products.find(
    p => p.id === value || p.name === value || p.code === value
  );

  const displayValue = selectedProduct ? selectedProduct.name : value;

  const onSelectHandler = (val: Product | string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 w-full justify-between px-2 text-xs font-normal",
            !displayValue && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {displayValue || "Select or type new..."}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
        <Command>
          <CommandInput
            placeholder="Search product..."
            value={search}
            onValueChange={setSearch}
            className="h-9 text-xs"
            autoFocus
          />
          <CommandList className="max-h-[200px]">
            {search && !products.find(p => p.name.toLowerCase() === search.toLowerCase()) && (
              <CommandGroup>
                <CommandItem
                  value={search}
                  onSelect={() => onSelectHandler(search)}
                  className="text-xs"
                >
                  <Plus className="mr-2 h-3 w-3" />
                  Add "{search}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandEmpty className="py-2 px-2 text-center text-xs text-muted-foreground">
              No products found.
            </CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.code} ${p.name}`}
                  onSelect={() => onSelectHandler(p)}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      selectedProduct?.id === p.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">{p.code}</span>
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