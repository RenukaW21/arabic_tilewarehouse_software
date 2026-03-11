import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrderApi } from '@/api/miscApi';
import { vendorApi } from '@/api/vendorApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import type { PurchaseOrder, CreatePODto } from '@/types/misc.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { POCreateEditDialog } from '@/components/shared/POCreateEditDialog';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, Eye, CheckCircle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

type PaymentStatus = 'pending' | 'partial' | 'paid';

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen]       = useState(false);
  const [editing, setEditing]             = useState<PurchaseOrder | null>(null);
  const [deleting, setDeleting]           = useState<PurchaseOrder | null>(null);
  const [approving, setApproving]         = useState<PurchaseOrder | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<PurchaseOrder | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [page, setPage]                   = useState(1);
  const [searchInput, setSearchInput]     = useState('');
  const [search, setSearch]               = useState('');

  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    sortBy: 'created_at',
    sortOrder: 'DESC' as const,
  };

  // ─── Lookups ──────────────────────────────────────────────────────────────
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', { limit: 500 }],
    queryFn: () => vendorApi.getAll({ limit: 500 }),
  });
  const vendors = vendorsData?.data ?? [];

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses', { limit: 500 }],
    queryFn: () => warehouseApi.getAll({ limit: 500 }),
  });
  const warehouses = warehousesData?.data ?? [];

  const { data: productsData } = useQuery({
    queryKey: ['products', { limit: 500 }],
    queryFn: () => productApi.getAll({ page: 1, limit: 500 }),
  });
  const productsList = productsData?.data ?? [];

  // ─── PO List ──────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', listParams],
    queryFn: () => purchaseOrderApi.getAll(listParams),
  });

  const orders: PurchaseOrder[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  // ─── Derived options ──────────────────────────────────────────────────────
  const vendorOptions    = vendors.map((v) => ({ value: v.id, label: v.name }));
  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));
  const products         = productsList.map((p) => ({
    id:       p.id,
    code:     p.code ?? '',
    name:     p.name,
    mrp:      p.mrp ?? null,
    gst_rate: p.gstRate ?? 18,
  }));

  const getVendorName    = (id: string) => vendors.find((v) => v.id === id)?.name ?? '—';
  const getWarehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? '—';

  // ─── Mutations ────────────────────────────────────────────────────────────
  const invalidatePOs = () => qc.invalidateQueries({ queryKey: ['purchase-orders'] });

  const saveMutation = useMutation({
    mutationFn: async (payload: CreatePODto) => {
      if (editing) {
        const res = await purchaseOrderApi.update(editing.id, payload);
        return res.data;
      }
      const res = await purchaseOrderApi.create(payload);
      return res.data;
    },
    onSuccess: () => {
      invalidatePOs();
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? 'PO updated' : 'PO created');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Operation failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => purchaseOrderApi.delete(id),
    onSuccess: () => {
      invalidatePOs();
      setDeleting(null);
      toast.success('PO cancelled');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Cancel failed');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => purchaseOrderApi.approve(id),
    onSuccess: () => {
      invalidatePOs();
      setApproving(null);
      toast.success('PO approved');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Approve failed');
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PaymentStatus }) =>
      purchaseOrderApi.updatePaymentStatus(id, status),
    onSuccess: () => {
      invalidatePOs();
      setPaymentTarget(null);
      toast.success('Payment status updated');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Update failed');
    },
  });

  // ─── Open edit/view dialog ────────────────────────────────────────────────
  const openEditDialog = (r: PurchaseOrder) => {
    setEditing(r);
    setDialogOpen(true);
  };

  // ─── Columns ──────────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'po_number',
      label: 'PO #',
      render: (r: PurchaseOrder) => (
        <button
          type="button"
          className="font-mono text-sm font-medium text-primary hover:underline"
          onClick={() => navigate(`/purchase/orders/${r.id}`)}
        >
          {r.po_number}
        </button>
      ),
    },
    {
      key: 'vendor',
      label: 'Vendor',
      render: (r: PurchaseOrder) => r.vendor_name ?? getVendorName(r.vendor_id),
    },
    {
      key: 'warehouse',
      label: 'Warehouse',
      render: (r: PurchaseOrder) => r.warehouse_name ?? getWarehouseName(r.warehouse_id),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: PurchaseOrder) => <StatusBadge status={r.status} />,
    },
    {
      key: 'payment_status',
      label: 'Payment',
      render: (r: PurchaseOrder) => <StatusBadge status={r.payment_status ?? 'pending'} />,
    },
    {
      key: 'order_date',
      label: 'Order Date',
      render: (r: PurchaseOrder) =>
        r.order_date ? new Date(r.order_date).toLocaleDateString('en-IN') : '—',
    },
    {
      key: 'expected_date',
      label: 'Expected Date',
      render: (r: PurchaseOrder) =>
        r.expected_date ? new Date(r.expected_date).toLocaleDateString('en-IN') : '—',
    },
    // FIX #9 — Added "Received Date" column per spec:
    // disabled during creation, only editable when receiving items (enforced by backend + dialog)
    {
      key: 'received_date',
      label: 'Received Date',
      render: (r: PurchaseOrder) =>
        r.received_date ? new Date(r.received_date).toLocaleDateString('en-IN') : '—',
    },
    {
      key: 'grand_total',
      label: 'Total',
      render: (r: PurchaseOrder) => `₹${Number(r.grand_total ?? 0).toLocaleString()}`,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: PurchaseOrder) => (
        <div className="flex gap-1">
          {/* View — always visible */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(`/purchase/orders/${r.id}`)}
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {/* Edit — always visible. Non-draft opens in limited-edit mode (received_date + notes only) */}
          {/* <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openEditDialog(r)}
            title={r.status === 'draft' ? 'Edit PO' : 'Edit received date / notes'}
          >
            <Pencil className="h-4 w-4" />
          </Button> */}

          {/* Approve + Cancel — only for draft */}
          {r.status === 'draft' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setApproving(r)}
                title="Approve"
              >
                <CheckCircle className="h-4 w-4 text-green-600" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => setDeleting(r)}
                title="Cancel PO"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Payment status — only for confirmed / partial / received */}
          {['confirmed', 'partial', 'received'].includes(r.status) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600"
              onClick={() => {
                setPaymentTarget(r);
                setPaymentStatus((r.payment_status as PaymentStatus) ?? 'pending');
              }}
              title="Update payment status"
            >
              <CreditCard className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage purchase orders"
        onAdd={() => { setEditing(null); setDialogOpen(true); }}
        addLabel="New PO"
      />

      <DataTableShell<PurchaseOrder>
        data={orders}
        columns={columns}
        searchKey="po_number"
        searchPlaceholder="Search by PO #..."
        serverSide
        searchValue={searchInput}
        onSearchChange={(v) => { setSearchInput(v); applySearch(v); }}
        paginationMeta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {/* Create / Edit */}
      <POCreateEditDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSubmit={(d) => saveMutation.mutateAsync(d)}
        loading={saveMutation.isPending}
        vendors={vendorOptions}
        warehouses={warehouseOptions}
        products={products}
        initial={editing ?? undefined}
      />

      {/* Cancel confirm */}
      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting ? deleteMutation.mutateAsync(deleting.id) : Promise.resolve()}
        loading={deleteMutation.isPending}
        title="Cancel Purchase Order?"
        description="This will cancel the PO. You cannot cancel if a GRN is already linked."
      />

      {/* Approve confirm */}
      <Dialog open={!!approving} onOpenChange={(open) => !open && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Purchase Order</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Approve <strong>{approving?.po_number}</strong>? Status will change from{' '}
            <strong>Draft</strong> to <strong>Confirmed</strong> and it can no longer be edited.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => approving && approveMutation.mutate(approving.id)}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment status */}
      <Dialog open={!!paymentTarget} onOpenChange={(open) => !open && setPaymentTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              PO <strong>{paymentTarget?.po_number}</strong> — Grand total:{' '}
              <strong>₹{Number(paymentTarget?.grand_total ?? 0).toLocaleString()}</strong>
            </p>
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select
                value={paymentStatus}
                onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                paymentTarget &&
                paymentMutation.mutate({ id: paymentTarget.id, status: paymentStatus })
              }
              disabled={paymentMutation.isPending}
            >
              {paymentMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
