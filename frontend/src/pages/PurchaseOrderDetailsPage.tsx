import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrderApi } from '@/api/miscApi';
import { grnApi } from '@/api/grnApi';
import type { PurchaseOrder } from '@/types/misc.types';
import type { GRN } from '@/types/grn.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { POCreateEditDialog } from '@/components/shared/POCreateEditDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { ArrowLeft, Pencil, Trash2, CheckCircle, CreditCard, Plus, Eye, Save, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { vendorApi } from '@/api/vendorApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';

type POStatus      = 'draft' | 'confirmed' | 'partial' | 'received' | 'cancelled';
type PaymentStatus = 'pending' | 'partial' | 'paid';

// ─── Status transition rules ──────────────────────────────────────────────────
// Only show statuses that make sense to transition TO from the current status
const ALLOWED_NEXT_STATUSES: Record<POStatus, POStatus[]> = {
  draft:      ['confirmed', 'cancelled'],
  confirmed:  ['partial', 'received', 'cancelled'],
  partial:    ['received', 'cancelled'],
  received:   [],                          // terminal — no manual changes
  cancelled:  ['draft'],                   // allow reverting a cancelled PO back to draft
};

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <p className="font-medium text-sm mt-0.5">{value || '—'}</p>
    </div>
  );
}

export default function PurchaseOrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editOpen, setEditOpen]           = useState(false);
  const [deleteOpen, setDeleteOpen]       = useState(false);
  const [approveOpen, setApproveOpen]     = useState(false);
  const [paymentOpen, setPaymentOpen]     = useState(false);
  const [statusOpen, setStatusOpen]       = useState(false);   // ← new
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [newStatus, setNewStatus]         = useState<POStatus>('confirmed'); // ← new

  // ─── Inline received-qty editing state ───────────────────────────────────
  const [editingReceived, setEditingReceived] = useState<Record<string, string>>({});

  // ─── PO Data ──────────────────────────────────────────────────────────────
  const { data: poRes, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => purchaseOrderApi.getById(id!),
    enabled: !!id,
  });

  // ─── Lookups ──────────────────────────────────────────────────────────────
  const { data: vendorsData }    = useQuery({ queryKey: ['vendors',    { limit: 500 }], queryFn: () => vendorApi.getAll({ limit: 500 }) });
  const { data: warehousesData } = useQuery({ queryKey: ['warehouses', { limit: 500 }], queryFn: () => warehouseApi.getAll({ limit: 500 }) });
  const { data: productsData }   = useQuery({ queryKey: ['products',   { limit: 500 }], queryFn: () => productApi.getAll({ page: 1, limit: 500 }) });

  const vendors      = vendorsData?.data    ?? [];
  const warehouses   = warehousesData?.data ?? [];
  const productsList = productsData?.data   ?? [];

  const vendorOptions    = vendors.map((v) => ({ value: v.id, label: v.name }));
  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));
  const products         = productsList.map((p) => ({
    id:       p.id,
    code:     p.code    ?? '',
    name:     p.name,
    mrp:      p.mrp     ?? null,
    gst_rate: p.gstRate ?? 18,
  }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['purchase-orders', id] });
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
  };

  // ─── Mutations ────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: () => purchaseOrderApi.approve(id!),
    onSuccess: () => { invalidate(); setApproveOpen(false); toast.success('PO approved'); },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) =>
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Approve failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => purchaseOrderApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setDeleteOpen(false);
      toast.success('PO cancelled');
      navigate('/purchase/orders');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) =>
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Cancel failed'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof purchaseOrderApi.update>[1]) =>
      purchaseOrderApi.update(id!, payload),
    onSuccess: () => { invalidate(); setEditOpen(false); toast.success('PO updated'); },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) =>
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Update failed'),
  });

  const paymentMutation = useMutation({
    mutationFn: (status: PaymentStatus) => purchaseOrderApi.updatePaymentStatus(id!, status),
    onSuccess: () => { invalidate(); setPaymentOpen(false); toast.success('Payment status updated'); },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) =>
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Update failed'),
  });

  // ─── Status mutation ───────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: (status: POStatus) => purchaseOrderApi.updateStatus(id!, status),
    onSuccess: () => { invalidate(); setStatusOpen(false); toast.success('PO status updated'); },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) =>
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Status update failed'),
  });

  // ─── Receive item mutation ─────────────────────────────────────────────────
  const receiveItemMutation = useMutation({
    mutationFn: ({ itemId, received_boxes }: { itemId: string; received_boxes: number }) =>
      purchaseOrderApi.receiveItem(id!, itemId, received_boxes),
    onSuccess: (_data, { itemId }) => {
      invalidate();
      setEditingReceived((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      toast.success('Received quantity updated');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) =>
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Update failed'),
  });

  // ─── Linked GRNs ──────────────────────────────────────────────────────────
  const { data: grnsRes } = useQuery({
    queryKey: ['grns', { purchase_order_id: id }],
    queryFn:  () => grnApi.getAll({ purchase_order_id: id!, limit: 50, sortBy: 'created_at', sortOrder: 'DESC' } as Parameters<typeof grnApi.getAll>[0]),
    enabled:  !!id,
  });
  const linkedGRNs: GRN[] = grnsRes?.data ?? [];

  // ─── Guards ───────────────────────────────────────────────────────────────
  if (!id)        return <div className="p-4 text-destructive">Missing PO ID</div>;
  if (isLoading)  return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (error || !poRes?.data) return <div className="p-4 text-destructive">Purchase order not found</div>;

  const po: PurchaseOrder = poRes.data;
  const isDraft           = po.status === 'draft';
  const canUpdatePay      = ['confirmed', 'partial', 'received'].includes(po.status);
  const canEditReceivedQty= ['confirmed', 'partial', 'received'].includes(po.status);
  const allowedNextStatuses = ALLOWED_NEXT_STATUSES[po.status as POStatus] ?? [];
  const canChangeStatus   = allowedNextStatuses.length > 0;

  const fmt   = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN') : '—';
  const fmtDt = (d?: string | null) => d ? new Date(d).toLocaleString('en-IN') : '—';

  // Status label map for display
  const STATUS_LABELS: Record<POStatus, string> = {
    draft:     'Draft',
    confirmed: 'Confirmed',
    partial:   'Partially Received',
    received:  'Fully Received',
    cancelled: 'Cancelled',
  };

  // ─── Inline received qty handlers ─────────────────────────────────────────
  const startEditingReceived = (itemId: string, currentValue: number) =>
    setEditingReceived((prev) => ({ ...prev, [itemId]: String(currentValue) }));

  const cancelEditingReceived = (itemId: string) =>
    setEditingReceived((prev) => { const next = { ...prev }; delete next[itemId]; return next; });

  const saveReceivedQty = (itemId: string, orderedBoxes: number) => {
    const value = parseFloat(editingReceived[itemId]);
    if (isNaN(value) || value < 0) { toast.error('Enter a valid quantity (≥ 0)'); return; }
    if (value > orderedBoxes) { toast.error(`Received (${value}) cannot exceed ordered (${orderedBoxes})`); return; }
    receiveItemMutation.mutate({ itemId, received_boxes: value });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/purchase/orders')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
      </Button>

      <PageHeader title={po.po_number} subtitle="Purchase order details" />

      {/* Status row + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={po.status} />
        <StatusBadge status={po.payment_status ?? 'pending'} />
        {po.return_status && po.return_status !== 'none' && (
          <StatusBadge status={po.return_status} />
        )}

        {/* Edit received date / notes */}
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-1" />
          {isDraft ? 'Edit' : 'Edit received date / notes'}
        </Button>

        {/* Draft-only: Approve + Cancel */}
        {isDraft && (
          <>
            <Button
              variant="outline" size="sm"
              onClick={() => setApproveOpen(true)}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button
              variant="outline" size="sm" className="text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Cancel PO
            </Button>
          </>
        )}

        {/* Change Status — visible whenever there are valid next statuses */}
        {canChangeStatus && (
          <Button
            variant="outline" size="sm"
            onClick={() => {
              setNewStatus(allowedNextStatuses[0]); // pre-select first valid option
              setStatusOpen(true);
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Change Status
          </Button>
        )}

        {/* Payment status */}
        {canUpdatePay && (
          <Button
            variant="outline" size="sm"
            onClick={() => {
              setPaymentStatus((po.payment_status as PaymentStatus) ?? 'pending');
              setPaymentOpen(true);
            }}
          >
            <CreditCard className="h-4 w-4 mr-1" /> Payment Status
          </Button>
        )}
      </div>

      {/* Main info card */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DetailField label="Vendor"        value={po.vendor_name    ?? po.vendor_id} />
          <DetailField label="Warehouse"     value={po.warehouse_name ?? po.warehouse_id} />
          <DetailField label="Order Date"    value={fmt(po.order_date)} />
          <DetailField label="Expected Date" value={fmt(po.expected_date)} />
          <DetailField label="Received Date" value={fmt(po.received_date)} />
          <DetailField label="Created By"    value={po.created_by_name ?? po.created_by} />
          <DetailField label="Approved By"   value={po.approved_by_name ?? po.approved_by ?? '—'} />
          <DetailField label="Approved At"   value={fmtDt(po.approved_at)} />
          <div className="col-span-2 md:col-span-4">
            <DetailField label="Notes" value={po.notes} />
          </div>
        </div>
      </div>

      {/* Totals card */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <DetailField label="Sub Total"           value={`₹${Number(po.total_amount ?? 0).toLocaleString('en-IN')}`} />
          <DetailField label="Item Discount"       value={`₹${Number(po.discount_amount ?? 0).toLocaleString('en-IN')}`} />
          <DetailField label="Additional Discount" value={`₹${Number((po as any).additional_discount ?? 0).toLocaleString('en-IN')}`} />
          <DetailField label="Tax (GST)"           value={`₹${Number(po.tax_amount ?? 0).toLocaleString('en-IN')}`} />
          <DetailField
            label="Grand Total"
            value={<span className="text-base font-bold text-primary">₹{Number(po.grand_total ?? 0).toLocaleString('en-IN')}</span>}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-lg border">
        <div className="px-4 py-2 border-b bg-muted/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Line Items</h3>
          {canEditReceivedQty && (
            <p className="text-xs text-muted-foreground">Click the received quantity to edit it</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Shade</th>
                <th className="px-4 py-2 font-medium text-right">Ordered</th>
                <th className="px-4 py-2 font-medium text-right">
                  Received
                  {canEditReceivedQty && <span className="ml-1 text-[10px] font-normal text-muted-foreground">(editable)</span>}
                </th>
                <th className="px-4 py-2 font-medium text-right">Unit Price</th>
                <th className="px-4 py-2 font-medium text-right">Disc %</th>
                <th className="px-4 py-2 font-medium text-right">Tax %</th>
                <th className="px-4 py-2 font-medium text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {(po.items ?? []).map((item) => {
                const isEditing = item.id in editingReceived;
                const isSaving  = receiveItemMutation.isPending && receiveItemMutation.variables?.itemId === item.id;
                return (
                  <tr key={item.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2">
                      <span className="font-medium">{item.product_name ?? item.product_id}</span>
                      {item.product_code && <span className="ml-1 text-xs text-muted-foreground">({item.product_code})</span>}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {item.shade_name ?? item.shade_code ?? (item.shade_id ? item.shade_id : '—')}
                    </td>
                    <td className="px-4 py-2 text-right">{item.ordered_boxes}</td>
                    <td className="px-4 py-2 text-right">
                      {canEditReceivedQty ? (
                        isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number" min="0" max={item.ordered_boxes} step="0.01"
                              className="h-7 w-20 text-right text-xs"
                              value={editingReceived[item.id]}
                              onChange={(e) => setEditingReceived((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')  saveReceivedQty(item.id, Number(item.ordered_boxes));
                                if (e.key === 'Escape') cancelEditingReceived(item.id);
                              }}
                              autoFocus disabled={isSaving}
                            />
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600"
                              onClick={() => saveReceivedQty(item.id, Number(item.ordered_boxes))} disabled={isSaving} title="Save">
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                              onClick={() => cancelEditingReceived(item.id)} disabled={isSaving} title="Cancel">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <button type="button"
                            className="rounded px-2 py-0.5 hover:bg-muted cursor-pointer text-right w-full"
                            onClick={() => startEditingReceived(item.id, Number(item.received_boxes ?? 0))}
                            title="Click to edit received quantity">
                            {item.received_boxes ?? 0}
                          </button>
                        )
                      ) : (
                        <span>{item.received_boxes ?? 0}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">₹{Number(item.unit_price).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{item.discount_pct ?? 0}%</td>
                    <td className="px-4 py-2 text-right">{item.tax_pct ?? 0}%</td>
                    <td className="px-4 py-2 text-right font-medium">₹{Number(item.line_total ?? 0).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(!po.items || po.items.length === 0) && (
          <p className="px-4 py-6 text-center text-muted-foreground text-sm">No line items</p>
        )}
      </div>

      {/* Linked GRNs */}
      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b bg-muted/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Goods Receipt Notes (GRNs)</h3>
          {['confirmed', 'partial'].includes(po.status) && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/purchase/grn?po_id=${po.id}`)}>
              <Plus className="h-4 w-4 mr-1" /> Create GRN
            </Button>
          )}
        </div>
        {linkedGRNs.length === 0 ? (
          <p className="px-4 py-6 text-center text-muted-foreground text-sm">
            No GRNs linked to this purchase order yet.
            {['confirmed', 'partial'].includes(po.status) && (
              <button type="button" className="ml-1 text-primary underline hover:no-underline"
                onClick={() => navigate(`/purchase/grn?po_id=${po.id}`)}>
                Create one now
              </button>
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="px-4 py-2 font-medium">GRN #</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Receipt Date</th>
                  <th className="px-4 py-2 font-medium">Invoice #</th>
                  <th className="px-4 py-2 font-medium">Vehicle #</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {linkedGRNs.map((grn: GRN & { vehicle_number?: string }) => (
                  <tr key={grn.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2">
                      <button type="button" className="font-mono text-sm font-medium text-primary hover:underline"
                        onClick={() => navigate(`/purchase/grn/${grn.id}`)}>
                        {grn.grn_number}
                      </button>
                    </td>
                    <td className="px-4 py-2"><StatusBadge status={grn.status} /></td>
                    <td className="px-4 py-2">{grn.receipt_date ? new Date(grn.receipt_date).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{grn.invoice_number ?? '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{grn.vehicle_number ?? '—'}</td>
                    <td className="px-4 py-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="View GRN"
                        onClick={() => navigate(`/purchase/grn/${grn.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}

      {/* Edit PO */}
      <POCreateEditDialog
        open={editOpen} onClose={() => setEditOpen(false)}
        onSubmit={(d) => updateMutation.mutateAsync(d)} loading={updateMutation.isPending}
        vendors={vendorOptions} warehouses={warehouseOptions} products={products} initial={po}
      />

      {/* Approve */}
      <Dialog open={approveOpen} onOpenChange={(v) => !v && setApproveOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Purchase Order</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Approve <strong>{po.po_number}</strong>? Status will change to <strong>Confirmed</strong> and the order can no longer be edited.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel / delete */}
      <DeleteConfirmDialog
        open={deleteOpen} onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutateAsync()} loading={deleteMutation.isPending}
        title="Cancel Purchase Order?"
        description="This will cancel the PO. You cannot cancel if a GRN is already linked."
      />

      {/* Change Status dialog */}
      <Dialog open={statusOpen} onOpenChange={(v) => !v && setStatusOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change PO Status</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Current status: <strong>{STATUS_LABELS[po.status as POStatus]}</strong>
            </p>
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as POStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedNextStatuses.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button onClick={() => statusMutation.mutate(newStatus)} disabled={statusMutation.isPending}>
              {statusMutation.isPending ? 'Saving...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment status */}
      <Dialog open={paymentOpen} onOpenChange={(v) => !v && setPaymentOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Payment Status</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              PO <strong>{po.po_number}</strong> — Grand total:{' '}
              <strong>₹{Number(po.grand_total ?? 0).toLocaleString()}</strong>
            </p>
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={() => paymentMutation.mutate(paymentStatus)} disabled={paymentMutation.isPending}>
              {paymentMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
