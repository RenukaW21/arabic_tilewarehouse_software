import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi, MarketplacePlatform } from '@/api/marketplaceApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const PLATFORM_BADGE: Record<MarketplacePlatform, string> = {
  amazon:   'bg-orange-100 text-orange-700',
  flipkart: 'bg-blue-100 text-blue-700',
  meesho:   'bg-pink-100 text-pink-700',
};

export default function MarketplacePricingPage() {
  const queryClient = useQueryClient();

  const [filterPlatform, setFilterPlatform] = useState<MarketplacePlatform | 'all'>('all');
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{ product_id: string; platform: MarketplacePlatform | ''; price: string }>({
    product_id: '', platform: '', price: '',
  });

  const params = {
    page,
    limit: 50,
    ...(filterPlatform !== 'all' && { platform: filterPlatform }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-pricing', params],
    queryFn: () => marketplaceApi.pricing.getAll(params),
  });

  const rows  = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const upsertMutation = useMutation({
    mutationFn: () => marketplaceApi.pricing.upsert({
      product_id: form.product_id,
      platform:   form.platform as MarketplacePlatform,
      price:      parseFloat(form.price),
    }),
    onSuccess: () => {
      toast.success('Price saved');
      queryClient.invalidateQueries({ queryKey: ['marketplace-pricing'] });
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to save price');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ productId, platform }: { productId: string; platform: MarketplacePlatform }) =>
      marketplaceApi.pricing.remove(productId, platform),
    onSuccess: () => {
      toast.success('Price removed');
      queryClient.invalidateQueries({ queryKey: ['marketplace-pricing'] });
    },
    onError: () => {
      toast.error('Failed to remove price');
    },
  });

  const openAdd = () => {
    setForm({ product_id: '', platform: '', price: '' });
    setDialogOpen(true);
  };

  const openEdit = (row: typeof rows[0]) => {
    setForm({ product_id: row.product_id, platform: row.platform, price: String(row.price) });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.product_id.trim()) { toast.error('Product ID is required'); return; }
    if (!form.platform)          { toast.error('Platform is required'); return; }
    if (!form.price || isNaN(parseFloat(form.price))) { toast.error('Valid price is required'); return; }
    upsertMutation.mutate();
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Marketplace Pricing</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Set independent prices per product per platform. Changes require admin approval before syncing.
          </p>
        </div>
        <Button onClick={openAdd}>+ Set Price</Button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={filterPlatform} onValueChange={v => { setFilterPlatform(v as any); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="amazon">Amazon</SelectItem>
            <SelectItem value="flipkart">Flipkart</SelectItem>
            <SelectItem value="meesho">Meesho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Price (₹)</TableHead>
              <TableHead>Updated By</TableHead>
              <TableHead>Updated At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No marketplace prices set yet.</TableCell></TableRow>
            ) : rows.map(row => (
              <TableRow key={`${row.product_id}-${row.platform}`}>
                <TableCell className="text-sm font-medium">{row.product_name ?? row.product_id}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.product_sku ?? '—'}</TableCell>
                <TableCell>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLATFORM_BADGE[row.platform]}`}>
                    {row.platform.charAt(0).toUpperCase() + row.platform.slice(1)}
                  </span>
                </TableCell>
                <TableCell className="font-semibold">₹{Number(row.price).toFixed(2)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.updated_by_name ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(row.updated_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ productId: row.product_id, platform: row.platform })}
                      disabled={deleteMutation.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages} · {total} records</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) openAdd(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{form.product_id && form.platform ? 'Edit Price' : 'Set Marketplace Price'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Product ID</Label>
              <Input
                placeholder="Paste product UUID..."
                value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">Find the product UUID from the Products page.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v as MarketplacePlatform }))}>
                <SelectTrigger><SelectValue placeholder="Select platform..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="amazon">Amazon</SelectItem>
                  <SelectItem value="flipkart">Flipkart</SelectItem>
                  <SelectItem value="meesho">Meesho</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Price (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? 'Saving...' : 'Save Price'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
