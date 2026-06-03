import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceApi } from '@/api/salesApi';
import { salesOrdersApi } from '@/api/salesApi';
import type { Invoice, InvoiceItem } from '@/types/invoice.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileCheck, Trash2, Pencil, Download } from 'lucide-react';
import { generateInvoicePDF } from '@/utils/pdfGenerator';
import { extractApiError } from '@/utils/apiError';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { useTranslation } from 'react-i18next';

export default function InvoicesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [salesOrderId, setSalesOrderId] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState({
    invoice_date: '', due_date: '', billing_address: '', shipping_address: '',
    notes: '', place_of_supply: '', is_igst: false,
  });
  type EditItem = { product_id: string; product_name: string; product_code: string; shade_id: string | null; hsn_code: string; quantity_boxes: number; unit_price: number; discount_pct: number; gst_rate: number; };
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [paymentDialogInvoice, setPaymentDialogInvoice] = useState<Invoice | null>(null);
  const [paymentDialogValue, setPaymentDialogValue] = useState<'pending' | 'partial' | 'paid'>('pending');
  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    paymentStatus: paymentFilter || undefined,
    sortBy: 'invoice_date',
    sortOrder: 'DESC' as const,
  };

  const { data: listData, isLoading } = useQuery({
    queryKey: ['invoices', listParams],
    queryFn: () => invoiceApi.getAll(listParams),
  });
  const invoices: Invoice[] = listData?.data ?? [];
  const meta = listData?.meta ?? null;

  const { data: soList } = useQuery({
    queryKey: ['sales-orders-for-invoice'],
    queryFn: () => salesOrdersApi.getAll({ limit: 100 }),
  });
  const orderOptions = (soList?.data ?? []).filter(
    (so) => ['confirmed', 'pick_ready', 'dispatched'].includes(so.status)
  );

  const { data: detailRes } = useQuery({
    queryKey: ['invoices', detailId],
    queryFn: () => invoiceApi.getById(detailId!),
    enabled: !!detailId,
  });
  const detail = detailRes?.data ?? null;

  const createMutation = useMutation({
    mutationFn: () => invoiceApi.createFromSO({ sales_order_id: salesOrderId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setCreateOpen(false);
      setSalesOrderId('');
      toast.success('Invoice created from sales order');
    },
    onError: (e: unknown) => toast.error(extractApiError(e, 'Create failed')),
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => invoiceApi.issueInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['invoices', detailId] });
      toast.success('Invoice issued');
    },
    onError: (e: unknown) => toast.error(extractApiError(e, 'Issue failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoiceApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['invoices', detailId] });
      setDeleting(null);
      toast.success('Invoice deleted');
    },
    onError: (e: unknown) => toast.error(extractApiError(e, 'Delete failed')),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      editingInvoice
        ? invoiceApi.update(editingInvoice.id, {
            invoice_date: editForm.invoice_date || undefined,
            due_date: editForm.due_date || undefined,
            billing_address: editForm.billing_address || undefined,
            shipping_address: editForm.shipping_address || undefined,
            notes: editForm.notes || undefined,
            place_of_supply: editForm.place_of_supply || undefined,
            is_igst: editForm.is_igst,
            items: editItems,
          })
        : Promise.reject(new Error('No invoice')),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['invoices', detailId] });
      setEditingInvoice(null);
      toast.success('Invoice updated');
    },
    onError: (e: unknown) => toast.error(extractApiError(e, 'Update failed')),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, payment_status }: { id: string; payment_status: 'pending' | 'partial' | 'paid' }) =>
      invoiceApi.updatePaymentStatus(id, payment_status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['customer-payments'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['invoices', detailId] });
      setPaymentDialogInvoice(null);
      toast.success('Payment status updated');
    },
    onError: (e: unknown) => toast.error(extractApiError(e, 'Update failed')),
  });

  const columns = [
    { key: 'invoice_number', label: t('invoicesPage.invoiceHash'), render: (r: Invoice) => <span className="font-mono text-sm font-medium">{r.invoice_number}</span> },
    { key: 'customer_name', label: t('invoicesPage.customer'), render: (r: Invoice) => (r as any).customer_name ?? '—' },
    { key: 'invoice_date', label: t('invoicesPage.date'), render: (r: Invoice) => (r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : '—') },
    { key: 'grand_total', label: t('invoicesPage.total'), render: (r: Invoice) => `₹${Number((r as any).grand_total ?? 0).toLocaleString()}` },
    { key: 'status', label: t('invoicesPage.status'), render: (r: Invoice) => <StatusBadge status={r.status} /> },
    { key: 'payment_status', label: t('invoicesPage.payment'), render: (r: Invoice) => <StatusBadge status={(r as any).payment_status ?? 'pending'} /> },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (r: Invoice) => (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setDetailId(r.id)}>{t('invoicesPage.view')}</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPaymentDialogInvoice(r);
              const p = (r as any).payment_status ?? 'pending';
              setPaymentDialogValue(['pending', 'partial', 'paid'].includes(p) ? p : 'pending');
            }}
            title={t('invoicesPage.changePaymentStatus')}
          >
            {t('invoicesPage.payment_btn')}
          </Button>
          {r.status === 'issued' && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const res = await invoiceApi.getById(r.id);
                if (res?.data) {
                  generateInvoicePDF(res.data as any);
                }
              }}
              title="Download PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {r.status !== 'cancelled' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const full = await invoiceApi.getById(r.id);
                    const inv = (full?.data ?? r) as any;
                    setEditingInvoice(inv as Invoice);
                    setEditForm({
                      invoice_date: inv.invoice_date ? String(inv.invoice_date).slice(0, 10) : '',
                      due_date: inv.due_date ? String(inv.due_date).slice(0, 10) : '',
                      billing_address: inv.billing_address ?? '',
                      shipping_address: inv.shipping_address ?? '',
                      notes: inv.notes ?? '',
                      place_of_supply: inv.place_of_supply ?? '',
                      is_igst: !!inv.is_igst,
                    });
                    setEditItems((inv.items ?? []).map((it: any) => ({
                      product_id: it.product_id,
                      product_name: it.product_name ?? '',
                      product_code: it.product_code ?? '',
                      shade_id: it.shade_id ?? null,
                      hsn_code: it.hsn_code ?? '',
                      quantity_boxes: Number(it.quantity_boxes ?? 0),
                      unit_price: Number(it.unit_price ?? 0),
                      discount_pct: Number(it.discount_pct ?? 0),
                      gst_rate: Number(it.gst_rate ?? 0),
                    })));
                  } catch {
                    setEditingInvoice(r as Invoice);
                  }
                }}
                title={t('common.edit')}
              >
                <Pencil className="h-4 w-4 mr-1" /> {t('common.edit')}
              </Button>
              {r.status === 'draft' && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => issueMutation.mutate(r.id)}
                    disabled={issueMutation.isPending}
                  >
                    <FileCheck className="h-4 w-4 mr-1" /> {t('invoicesPage.issue')}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)} title={t('common.delete')}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('invoicesPage.title')}
        subtitle={t('invoicesPage.subtitle')}
        onAdd={() => setCreateOpen(true)}
        addLabel={t('invoicesPage.newInvoice')}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{t('invoicesPage.allStatuses')}</option>
          <option value="draft">{t('invoicesPage.statusDraft')}</option>
          <option value="issued">{t('invoicesPage.statusIssued')}</option>
          <option value="cancelled">{t('invoicesPage.statusCancelled')}</option>
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{t('invoicesPage.allPayments')}</option>
          <option value="pending">{t('invoicesPage.paymentPending')}</option>
          <option value="partial">{t('invoicesPage.paymentPartial')}</option>
          <option value="paid">{t('invoicesPage.paymentPaid')}</option>
        </select>
      </div>
      <DataTableShell<Invoice>
        data={invoices}
        columns={columns}
        searchPlaceholder={t('invoicesPage.searchPlaceholder')}
        serverSide
        searchValue={searchInput}
        onSearchChange={(v) => { setSearchInput(v); applySearch(v); }}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invoicesPage.createFromSO')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('invoicesPage.confirmedOrders')}</Label>
            <Select value={salesOrderId} onValueChange={setSalesOrderId}>
              <SelectTrigger><SelectValue placeholder={t('invoicesPage.selectOrder')} /></SelectTrigger>
              <SelectContent>
                {orderOptions.map((so) => (
                  <SelectItem key={so.id} value={so.id}>{so.so_number} — {so.customer_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!salesOrderId || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('invoicesPage.createBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detail && (
        <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detail.invoice_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">{t('invoicesPage.customer')}</span>
                <span>{detail.customer_name ?? '—'}</span>
                <span className="text-muted-foreground">{t('invoicesPage.customerGstin')}</span>
                <span>{detail.customer_gstin ?? '—'}</span>
                <span className="text-muted-foreground">{t('invoicesPage.invoiceDate')}</span>
                <span>{detail.invoice_date ? new Date(detail.invoice_date).toLocaleDateString() : '—'}</span>
                <span className="text-muted-foreground">{t('invoicesPage.dueDate')}</span>
                <span>{detail.due_date ? new Date(detail.due_date).toLocaleDateString() : '—'}</span>
                <span className="text-muted-foreground">{t('invoicesPage.status')}</span>
                <span><StatusBadge status={detail.status} /></span>
                <span className="text-muted-foreground">{t('invoicesPage.paymentStatus')}</span>
                <span className="flex items-center gap-2">
                  <Select
                    value={detail.payment_status ?? 'pending'}
                    onValueChange={(v: 'pending' | 'partial' | 'paid') =>
                      updatePaymentMutation.mutate({ id: detail.id, payment_status: v })
                    }
                  >
                    <SelectTrigger className="h-8 w-32" disabled={updatePaymentMutation.isPending}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{t('invoicesPage.paymentPending')}</SelectItem>
                      <SelectItem value="partial">{t('invoicesPage.paymentPartial')}</SelectItem>
                      <SelectItem value="paid">{t('invoicesPage.paymentPaid')}</SelectItem>
                    </SelectContent>
                  </Select>
                </span>
                <span className="text-muted-foreground">{t('invoicesPage.soNumber')}</span>
                <span>{detail.so_number ?? '—'}</span>
              </div>
              {(detail.billing_address || detail.shipping_address) && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {detail.billing_address && (
                    <>
                      <span className="text-muted-foreground">{t('invoicesPage.billingAddress')}</span>
                      <span className="whitespace-pre-wrap">{detail.billing_address}</span>
                    </>
                  )}
                  {detail.shipping_address && (
                    <>
                      <span className="text-muted-foreground">{t('invoicesPage.shippingAddress')}</span>
                      <span className="whitespace-pre-wrap">{detail.shipping_address}</span>
                    </>
                  )}
                </div>
              )}
              {detail.notes && (
                <div>
                  <span className="text-muted-foreground block mb-1">{t('invoicesPage.notes')}</span>
                  <p className="whitespace-pre-wrap">{detail.notes}</p>
                </div>
              )}
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">{t('invoicesPage.product')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('invoicesPage.hsn')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('invoicesPage.qty')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('invoicesPage.unitPrice')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('invoicesPage.discPct')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('invoicesPage.taxable')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('invoicesPage.gst')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('gstReport.cgst')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('gstReport.sgst')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('gstReport.igst')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('invoicesPage.lineTotal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.items ?? []).map((item: InvoiceItem) => (
                      <tr key={item.id ?? item.product_id} className="border-b">
                        <td className="px-4 py-2">{item.product_code} — {item.product_name}</td>
                        <td className="px-4 py-2 text-right">{item.hsn_code ?? '—'}</td>
                        <td className="px-4 py-2 text-right">{Number(item.quantity_boxes)}</td>
                        <td className="px-4 py-2 text-right">₹{Number(item.unit_price ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">{Number(item.discount_pct ?? 0)}%</td>
                        <td className="px-4 py-2 text-right">₹{Number(item.taxable_amount ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">{Number(item.gst_rate ?? 0)}%</td>
                        <td className="px-4 py-2 text-right">₹{Number(item.cgst_amount ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">₹{Number(item.sgst_amount ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">₹{Number(item.igst_amount ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">₹{Number(item.line_total ?? item.total_amount ?? 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col items-end gap-1 border-t pt-2">
                <div className="flex gap-8"><span className="text-muted-foreground w-32">{t('invoicesPage.subTotal')}</span><span>₹{(Number((detail as { sub_total?: number }).sub_total ?? detail.subtotal ?? 0) || 0).toLocaleString()}</span></div>
                <div className="flex gap-8"><span className="text-muted-foreground w-32">{t('invoicesPage.discount')}</span><span>₹{Number(detail.discount_amount ?? 0).toLocaleString()}</span></div>
                <div className="flex gap-8"><span className="text-muted-foreground w-32">{t('gstReport.cgst')}</span><span>₹{Number(detail.cgst_amount ?? 0).toLocaleString()}</span></div>
                <div className="flex gap-8"><span className="text-muted-foreground w-32">{t('gstReport.sgst')}</span><span>₹{Number(detail.sgst_amount ?? 0).toLocaleString()}</span></div>
                <div className="flex gap-8"><span className="text-muted-foreground w-32">{t('gstReport.igst')}</span><span>₹{Number(detail.igst_amount ?? 0).toLocaleString()}</span></div>
                <div className="flex gap-8 font-medium"><span className="text-muted-foreground w-32">{t('invoicesPage.grandTotal')}</span><span>₹{Number(detail.grand_total ?? 0).toLocaleString()}</span></div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => { if (deleting) await deleteMutation.mutateAsync(deleting.id); }}
        loading={deleteMutation.isPending}
        title={t('invoicesPage.deleteTitle')}
        description={t('invoicesPage.deleteDesc')}
      />

      <Dialog open={!!paymentDialogInvoice} onOpenChange={(open) => !open && setPaymentDialogInvoice(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('invoicesPage.changePaymentStatus')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {paymentDialogInvoice && (
              <p className="text-sm text-muted-foreground">
                {paymentDialogInvoice.invoice_number}
              </p>
            )}
            <div className="space-y-2">
              <Label>{t('invoicesPage.paymentStatus')}</Label>
              <Select
                value={paymentDialogValue}
                onValueChange={(v: 'pending' | 'partial' | 'paid') => setPaymentDialogValue(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t('invoicesPage.paymentPending')}</SelectItem>
                  <SelectItem value="partial">{t('invoicesPage.paymentPartial')}</SelectItem>
                  <SelectItem value="paid">{t('invoicesPage.paymentPaid')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogInvoice(null)}>{t('common.cancel')}</Button>
            <Button
              onClick={() =>
                paymentDialogInvoice &&
                updatePaymentMutation.mutate({ id: paymentDialogInvoice.id, payment_status: paymentDialogValue })
              }
              disabled={!paymentDialogInvoice || updatePaymentMutation.isPending}
            >
              {updatePaymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingInvoice} onOpenChange={(open) => !open && setEditingInvoice(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="h-4 w-4" />
              Edit Invoice —
              <span className="font-mono text-primary">{(editingInvoice as any)?.invoice_number}</span>
              <StatusBadge status={editingInvoice?.status ?? 'draft'} />
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* ── Header fields ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-lg border p-4">
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <Input value={(editingInvoice as any)?.customer_name ?? '—'} disabled className="bg-muted/40" />
              </div>
              <div className="space-y-1.5">
                <Label>Sales Order</Label>
                <Input value={(editingInvoice as any)?.so_number ?? '—'} disabled className="bg-muted/40 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Invoice Date</Label>
                <Input type="date" value={editForm.invoice_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, invoice_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={editForm.due_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Place of Supply</Label>
                <Input value={editForm.place_of_supply} placeholder="e.g. Gujarat"
                  onChange={(e) => setEditForm((f) => ({ ...f, place_of_supply: e.target.value }))} />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <Label>Tax Type</Label>
                <Select value={editForm.is_igst ? 'igst' : 'cgst_sgst'}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, is_igst: v === 'igst' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cgst_sgst">CGST + SGST (Intrastate)</SelectItem>
                    <SelectItem value="igst">IGST (Interstate)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Input value={editForm.notes} placeholder="Optional notes..."
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {/* ── Addresses ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Billing Address</Label>
                <Textarea value={editForm.billing_address} rows={3} className="resize-none"
                  placeholder="Billing address..."
                  onChange={(e) => setEditForm((f) => ({ ...f, billing_address: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Shipping Address</Label>
                <Textarea value={editForm.shipping_address} rows={3} className="resize-none"
                  placeholder="Shipping address..."
                  onChange={(e) => setEditForm((f) => ({ ...f, shipping_address: e.target.value }))} />
              </div>
            </div>

            {/* ── Line items (read-only) ── */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Line Items</Label>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">HSN</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Disc %</th>
                      <th className="px-3 py-2 text-right">GST %</th>
                      <th className="px-3 py-2 text-right">Taxable Amt</th>
                      <th className="px-3 py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editItems.map((item, idx) => {
                      const taxable = item.quantity_boxes * item.unit_price * (1 - item.discount_pct / 100);
                      const lineTotal = taxable * (1 + item.gst_rate / 100);
                      return (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <div className="font-medium">{item.product_name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{item.product_code}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{item.hsn_code || '—'}</td>
                          <td className="px-3 py-2 text-right">{item.quantity_boxes}</td>
                          <td className="px-3 py-2 text-right">₹{Number(item.unit_price).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-right">{item.discount_pct}%</td>
                          <td className="px-3 py-2 text-right">{item.gst_rate}%</td>
                          <td className="px-3 py-2 text-right">₹{taxable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right font-medium">₹{lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                    {editItems.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">No line items found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              {editItems.length > 0 && (() => {
                const subTotal = editItems.reduce((s, it) => s + it.quantity_boxes * it.unit_price * (1 - it.discount_pct / 100), 0);
                const grandTotal = editItems.reduce((s, it) => {
                  const taxable = it.quantity_boxes * it.unit_price * (1 - it.discount_pct / 100);
                  return s + taxable * (1 + it.gst_rate / 100);
                }, 0);
                const taxTotal = grandTotal - subTotal;
                return (
                  <div className="flex flex-col items-end gap-1 pt-2 text-sm">
                    <div className="flex gap-12"><span className="text-muted-foreground w-28">Subtotal</span><span>₹{subTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                    <div className="flex gap-12"><span className="text-muted-foreground w-28">{editForm.is_igst ? 'IGST' : 'CGST + SGST'}</span><span>₹{taxTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                    <div className="flex gap-12 font-semibold border-t pt-1"><span className="w-28">Grand Total</span><span className="text-green-700 dark:text-green-400">₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
                  </div>
                );
              })()}
            </div>

            {/* ── Loyalty Rewards ── */}
            {(() => {
              const earned   = Number((editingInvoice as any)?.loyalty_points_earned   ?? 0);
              const redeemed = Number((editingInvoice as any)?.loyalty_points_redeemed ?? 0);
              const balance  = Number((editingInvoice as any)?.loyalty_points_balance  ?? 0);
              if (earned === 0 && redeemed === 0 && balance === 0) return null;
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 flex flex-wrap items-center gap-6 text-sm">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">🎁 Loyalty Rewards</span>
                  {earned > 0 && (
                    <span className="text-muted-foreground">
                      Points Earned: <span className="font-medium text-foreground">{earned.toLocaleString('en-IN')}</span>
                    </span>
                  )}
                  {redeemed > 0 && (
                    <span className="text-muted-foreground">
                      Points Redeemed: <span className="font-medium text-foreground">{redeemed.toLocaleString('en-IN')}</span>
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    Current Balance: <span className="font-medium text-amber-700 dark:text-amber-400">{balance.toLocaleString('en-IN')} pts</span>
                  </span>
                </div>
              );
            })()}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setEditingInvoice(null)}>{t('common.cancel')}</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
