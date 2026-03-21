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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

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
    piecesPerBox: p.piecesPerBox,
    reorderLevelBoxes: p.reorderLevelBoxes,
  }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['purchase-orders', id] });
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
  };

  // ─── Mutations ────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: () => purchaseOrderApi.approve(id!),
    onSuccess: () => { invalidate(); setApproveOpen(false); toast.success(t('purchaseOrders.poApproved')); },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) =>
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Approve failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => purchaseOrderApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setDeleteOpen(false);
      toast.success(t('purchaseOrders.poCancelled'));
      navigate('/purchase/orders');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) =>
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Cancel failed'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof purchaseOrderApi.update>[1]) =>
      purchaseOrderApi.update(id!, payload),
    onSuccess: () => { invalidate(); setEditOpen(false); toast.success(t('purchaseOrders.poUpdated')); },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) =>
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Update failed'),
  });

  const paymentMutation = useMutation({
    mutationFn: (status: PaymentStatus) => purchaseOrderApi.updatePaymentStatus(id!, status),
    onSuccess: () => { invalidate(); setPaymentOpen(false); toast.success(t('purchaseOrders.paymentUpdated')); },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) =>
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Update failed'),
  });

  // ─── Status mutation ───────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: (status: POStatus) => purchaseOrderApi.updateStatus(id!, status),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['grns'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      setStatusOpen(false);
      toast.success(t('purchaseOrders.poUpdated'));
    },
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
  if (!id)        return <div className="p-4 text-destructive">{t('purchaseOrders.missingId')}</div>;
  if (isLoading)  return <div className="p-4 text-muted-foreground">{t('common.loading')}</div>;
  if (error || !poRes?.data) return <div className="p-4 text-destructive">{t('purchaseOrders.notFound')}</div>;

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
    draft:     t('common.draft'),
    confirmed: t('common.confirmed'),
    partial:   t('purchaseOrders.partiallyReceived'),
    received:  t('purchaseOrders.fullyReceived'),
    cancelled: t('common.cancelled'),
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
        <ArrowLeft className="h-4 w-4 mr-1" /> {t('purchaseOrders.backToList')}
      </Button>

      <PageHeader title={po.po_number} subtitle={t('purchaseOrders.detailSubtitle')} />

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
          {isDraft ? t('common.edit') : t('purchaseOrders.editDateNotes')}
        </Button>

        {/* Draft-only: Approve + Cancel */}
        {isDraft && (
          <>
            <Button
              variant="outline" size="sm"
              onClick={() => setApproveOpen(true)}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-1" /> {t('common.approve')}
            </Button>
            <Button
              variant="outline" size="sm" className="text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> {t('purchaseOrders.cancelPO')}
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
            <RefreshCw className="h-4 w-4 mr-1" /> {t('purchaseOrders.changeStatus')}
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
            <CreditCard className="h-4 w-4 mr-1" /> {t('purchaseOrders.paymentStatus')}
          </Button>
        )}
      </div>

      {/* Main info card */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DetailField label={t('purchaseOrders.vendor')}         value={po.vendor_name    ?? po.vendor_id} />
          <DetailField label={t('purchaseOrders.warehouse')}      value={po.warehouse_name ?? po.warehouse_id} />
          <DetailField label={t('purchaseOrders.orderDate')}      value={fmt(po.order_date)} />
          <DetailField label={t('purchaseOrders.expectedDate')}   value={fmt(po.expected_date)} />
          <DetailField label={t('purchaseOrders.receivedDate')}   value={fmt(po.received_date)} />
          <DetailField label={t('purchaseOrders.createdBy')}      value={po.created_by_name ?? po.created_by} />
          <DetailField label={t('purchaseOrders.approvedBy')}     value={po.approved_by_name ?? po.approved_by ?? '—'} />
          <DetailField label={t('purchaseOrders.approvedAt')}     value={fmtDt(po.approved_at)} />
          <div className="col-span-2 md:col-span-4">
            <DetailField label={t('purchaseOrders.notes')} value={po.notes} />
          </div>
        </div>
      </div>

      {/* Totals card */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <DetailField label={t('purchaseOrders.subTotal')}           value={`₹${Number(po.total_amount ?? 0).toLocaleString('en-IN')}`} />
          <DetailField label={t('purchaseOrders.itemDiscount')}       value={`₹${Number(po.discount_amount ?? 0).toLocaleString('en-IN')}`} />
          <DetailField label={t('purchaseOrders.additionalDiscount')} value={`₹${Number((po as any).additional_discount ?? 0).toLocaleString('en-IN')}`} />
          <DetailField label={t('purchaseOrders.taxGst')}             value={`₹${Number(po.tax_amount ?? 0).toLocaleString('en-IN')}`} />
          <DetailField
            label={t('purchaseOrders.grandTotal')}
            value={<span className="text-base font-bold text-primary">₹{Number(po.grand_total ?? 0).toLocaleString('en-IN')}</span>}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-lg border">
        <div className="px-4 py-2 border-b bg-muted/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('purchaseOrders.lineItems')}</h3>
          {canEditReceivedQty && (
            <p className="text-xs text-muted-foreground">{t('purchaseOrders.clickQtyToEdit')}</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-4 py-2 font-medium">{t('common.product')}</th>
                <th className="px-4 py-2 font-medium">{t('purchaseOrders.shade')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('purchaseOrders.ordered')}</th>
                <th className="px-4 py-2 font-medium text-right">
                  {t('purchaseOrders.received')}
                  {canEditReceivedQty && <span className="ml-1 text-[10px] font-normal text-muted-foreground">({t('purchaseOrders.editable')})</span>}
                </th>
                <th className="px-4 py-2 font-medium text-right">{t('purchaseOrders.unitPrice')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('purchaseOrders.discPct')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('purchaseOrders.taxPct')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('purchaseOrders.lineTotal')}</th>
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
          <p className="px-4 py-6 text-center text-muted-foreground text-sm">{t('purchaseOrders.noLineItems')}</p>
        )}
      </div>

      {/* Linked GRNs */}
      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b bg-muted/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('purchaseOrders.linkedGRNs')}</h3>
          {['confirmed', 'partial'].includes(po.status) && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/purchase/grn?po_id=${po.id}`)}>
              <Plus className="h-4 w-4 mr-1" /> {t('purchaseOrders.createGRN')}
            </Button>
          )}
        </div>
        {linkedGRNs.length === 0 ? (
          <p className="px-4 py-6 text-center text-muted-foreground text-sm">
            {t('purchaseOrders.noGRNsLinked')}
            {['confirmed', 'partial'].includes(po.status) && (
              <button type="button" className="ml-1 text-primary underline hover:no-underline"
                onClick={() => navigate(`/purchase/grn?po_id=${po.id}`)}>
                {t('purchaseOrders.createOneNow')}
              </button>
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="px-4 py-2 font-medium">{t('purchaseOrders.grnHash')}</th>
                  <th className="px-4 py-2 font-medium">{t('common.status')}</th>
                  <th className="px-4 py-2 font-medium">{t('purchaseOrders.receiptDate')}</th>
                  <th className="px-4 py-2 font-medium">{t('purchaseOrders.invoiceHash')}</th>
                  <th className="px-4 py-2 font-medium">{t('purchaseOrders.vehicleHash')}</th>
                  <th className="px-4 py-2 font-medium">{t('common.actions')}</th>
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
          <DialogHeader><DialogTitle>{t('purchaseOrders.approvePO')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('purchaseOrders.approveConfirm', { number: po.po_number })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? t('common.approving') : t('common.approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel / delete */}
      <DeleteConfirmDialog
        open={deleteOpen} onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutateAsync()} loading={deleteMutation.isPending}
        title={t('purchaseOrders.cancelTitle')}
        description={t('purchaseOrders.cancelDesc')}
      />

      {/* Change Status dialog */}
      <Dialog open={statusOpen} onOpenChange={(v) => !v && setStatusOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('purchaseOrders.changeStatusTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {t('purchaseOrders.currentStatus')}: <strong>{STATUS_LABELS[po.status as POStatus]}</strong>
            </p>
            <div className="space-y-2">
              <Label>{t('purchaseOrders.newStatus')}</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as POStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedNextStatuses.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Auto-GRN info note */}
            {newStatus === 'received' && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <p className="font-medium mb-0.5">📦 {t('purchaseOrders.autoGrnWillBeGenerated')}</p>
                <p className="text-xs text-blue-700">
                  {t('purchaseOrders.markingAsReceived')}
                </p>
                <ul className="text-xs text-blue-700 list-disc list-inside mt-1 space-y-0.5">
                  <li>{t('purchaseOrders.autoGrnStep1')}</li>
                  <li>{t('purchaseOrders.autoGrnStep2')}</li>
                  <li>{t('purchaseOrders.autoGrnStep3', { warehouse: po.warehouse_name ?? t('purchaseOrders.theWarehouse') })}</li>
                  <li>{t('purchaseOrders.autoGrnStep4')}</li>
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => statusMutation.mutate(newStatus)}
              disabled={statusMutation.isPending}
              className={newStatus === 'received' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
            >
              {statusMutation.isPending
                ? (newStatus === 'received' ? t('purchaseOrders.generatingGRN') : t('common.saving'))
                : (newStatus === 'received' ? t('purchaseOrders.markReceivedAutoGRN') : t('purchaseOrders.updateStatus'))
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment status */}
      <Dialog open={paymentOpen} onOpenChange={(v) => !v && setPaymentOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('purchaseOrders.updatePaymentStatus')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {t('purchaseOrders.poNumber')}: <strong>{po.po_number}</strong> — {t('purchaseOrders.grandTotal')}:{' '}
              <strong>₹{Number(po.grand_total ?? 0).toLocaleString()}</strong>
            </p>
            <div className="space-y-2">
              <Label>{t('purchaseOrders.paymentStatus')}</Label>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t('common.pending')}</SelectItem>
                  <SelectItem value="partial">{t('common.partial')}</SelectItem>
                  <SelectItem value="paid">{t('common.paid')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => paymentMutation.mutate(paymentStatus)} disabled={paymentMutation.isPending}>
              {paymentMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
