import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi, MarketplacePlatform, OrderStatus } from '@/api/marketplaceApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped:   'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  returned:  'bg-orange-100 text-orange-700',
};

const PLATFORM_BADGE: Record<MarketplacePlatform, string> = {
  amazon:   'bg-orange-100 text-orange-700',
  flipkart: 'bg-blue-100 text-blue-700',
  meesho:   'bg-pink-100 text-pink-700',
};

export default function MarketplaceOrdersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [platform, setPlatform] = useState<MarketplacePlatform | 'all'>('all');
  const [status, setStatus]     = useState<OrderStatus | 'all'>('all');
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);

  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');

  const params = {
    page,
    limit: 25,
    ...(platform !== 'all' && { platform }),
    ...(status   !== 'all' && { status }),
    ...(search.trim() && { search: search.trim() }),
  };

  const { data: statsData } = useQuery({
    queryKey: ['marketplace-order-stats'],
    queryFn: () => marketplaceApi.orders.getStats(),
    staleTime: 0,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['marketplace-orders', params],
    queryFn: () => marketplaceApi.orders.getAll(params),
    staleTime: 0,
  });

  const orders = data?.data ?? [];
  const total  = data?.meta?.total ?? 0;
  const stats  = statsData?.data;

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, tracking_number }: { id: string; status: OrderStatus; tracking_number?: string }) =>
      marketplaceApi.orders.updateStatus(id, { status, tracking_number }),
    onSuccess: () => {
      toast({ title: 'Order updated' });
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-order-stats'] });
      setShipDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: 'Update failed', description: err?.response?.data?.error?.message, variant: 'destructive' });
    },
  });

  const openShip = (id: string) => {
    setSelectedOrderId(id);
    setTrackingNumber('');
    setShipDialogOpen(true);
  };

  const confirmShip = () => {
    if (!selectedOrderId) return;
    updateStatusMutation.mutate({
      id: selectedOrderId,
      status: 'shipped',
      tracking_number: trackingNumber.trim() || undefined,
    });
  };

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Marketplace Orders</h2>
        <p className="text-sm text-muted-foreground mt-1">Unified inbox for orders from all connected platforms.</p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total',     value: stats.total,     color: 'text-foreground' },
            { label: 'Pending',   value: stats.pending,   color: 'text-yellow-600' },
            { label: 'Confirmed', value: stats.confirmed, color: 'text-blue-600' },
            { label: 'Shipped',   value: stats.shipped,   color: 'text-indigo-600' },
            { label: 'Delivered', value: stats.delivered, color: 'text-green-600' },
            { label: 'Cancelled', value: stats.cancelled, color: 'text-red-600' },
            { label: 'Returned',  value: stats.returned,  color: 'text-orange-600' },
          ].map(s => (
            <div key={s.label} className="border rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={platform} onValueChange={v => { setPlatform(v as any); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="amazon">Amazon</SelectItem>
            <SelectItem value="flipkart">Flipkart</SelectItem>
            <SelectItem value="meesho">Meesho</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={v => { setStatus(v as any); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search order ID or customer..."
          className="w-60"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-red-500 text-sm">{(error as any)?.response?.data?.error?.message ?? 'Failed to load orders. Please refresh.'}</TableCell></TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No orders found.</TableCell></TableRow>
            ) : orders.map(order => (
              <TableRow key={order.id}>
                <TableCell>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLATFORM_BADGE[order.platform]}`}>
                    {order.platform.charAt(0).toUpperCase() + order.platform.slice(1)}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{order.platform_order_id}</TableCell>
                <TableCell className="text-sm">{order.customer_name ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {order.platform_order_date ? new Date(order.platform_order_date).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell className="text-sm">
                  {order.total_amount != null ? `${order.currency} ${Number(order.total_amount).toFixed(2)}` : '—'}
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[order.status]}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{order.tracking_number ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {order.status === 'confirmed' && (
                      <Button size="sm" variant="outline" onClick={() => openShip(order.id)}>
                        Ship
                      </Button>
                    )}
                    {order.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'confirmed' })}
                        disabled={updateStatusMutation.isPending}
                      >
                        Confirm
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages} · {total} orders</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Ship dialog */}
      <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark as Shipped</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tracking Number <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                placeholder="Enter tracking number..."
                value={trackingNumber}
                onChange={e => setTrackingNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmShip} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? 'Updating...' : 'Mark Shipped'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
