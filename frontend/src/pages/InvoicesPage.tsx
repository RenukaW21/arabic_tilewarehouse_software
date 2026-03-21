import { useState, useCallback } from 'react';
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
  const [editForm, setEditForm] = useState({ due_date: '', billing_address: '', shipping_address: '' });
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
    (so) => so.status === 'pick_ready' || so.status === 'dispatched'
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
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Create failed'),
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => invoiceApi.issueInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['invoices', detailId] });
      toast.success('Invoice issued');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Issue failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoiceApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['invoices', detailId] });
      setDeleting(null);
      toast.success('Invoice deleted');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      editingInvoice
        ? invoiceApi.update(editingInvoice.id, {
            due_date: editForm.due_date || undefined,
            billing_address: editForm.billing_address || undefined,
            shipping_address: editForm.shipping_address || undefined,
          })
        : Promise.reject(new Error('No invoice')),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['invoices', detailId] });
      setEditingInvoice(null);
      toast.success('Invoice updated');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Update failed'),
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
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Update failed'),
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
          {r.status === 'draft' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const full = await invoiceApi.getById(r.id);
                    const inv = full?.data ?? r;
                    setEditingInvoice(inv as Invoice);
                    setEditForm({
                      due_date: (inv as any).due_date ? String((inv as any).due_date).slice(0, 10) : '',
                      billing_address: (inv as any).billing_address ?? '',
                      shipping_address: (inv as any).shipping_address ?? '',
                    });
                  } catch {
                    setEditingInvoice(r as Invoice);
                    setEditForm({
                      due_date: (r as any).due_date ? String((r as any).due_date).slice(0, 10) : '',
                      billing_address: (r as any).billing_address ?? '',
                      shipping_address: (r as any).shipping_address ?? '',
                    });
                  }
                }}
                title={t('common.edit')}
              >
                <Pencil className="h-4 w-4 mr-1" /> {t('common.edit')}
              </Button>
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
                <div className="flex gap-8"><span className="text-muted-foreground w-32">{t('invoicesPage.subTotal')}</span><span>₹{Number((detail as { sub_total?: number }).sub_total ?? detail.subtotal ?? 0).toLocaleString()}</span></div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invoicesPage.editInvoice')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('invoicesPage.dueDate')}</Label>
              <Input
                type="date"
                value={editForm.due_date}
                onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('invoicesPage.billingAddress')}</Label>
              <Textarea
                value={editForm.billing_address}
                onChange={(e) => setEditForm((f) => ({ ...f, billing_address: e.target.value }))}
                placeholder={t('invoicesPage.billingAddr')}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('invoicesPage.shippingAddress')}</Label>
              <Textarea
                value={editForm.shipping_address}
                onChange={(e) => setEditForm((f) => ({ ...f, shipping_address: e.target.value }))}
                placeholder={t('invoicesPage.shippingAddr')}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInvoice(null)}>{t('common.cancel')}</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
