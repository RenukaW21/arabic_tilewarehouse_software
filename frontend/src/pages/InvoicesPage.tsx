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
import { Loader2, FileCheck, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';

export default function InvoicesPage() {
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
    mutationFn: () => invoiceApi.createFromSO({ salesOrderId }),
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
      if (detailId) qc.invalidateQueries({ queryKey: ['invoices', detailId] });
      setPaymentDialogInvoice(null);
      toast.success('Payment status updated');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Update failed'),
  });

  const columns = [
    { key: 'invoice_number', label: 'Invoice #', render: (r: Invoice) => <span className="font-mono text-sm font-medium">{r.invoice_number}</span> },
    { key: 'customer_name', label: 'Customer', render: (r: Invoice) => (r as any).customer_name ?? '—' },
    { key: 'invoice_date', label: 'Date', render: (r: Invoice) => (r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : '—') },
    { key: 'grand_total', label: 'Total', render: (r: Invoice) => `₹${Number((r as any).grand_total ?? 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (r: Invoice) => <StatusBadge status={r.status} /> },
    { key: 'payment_status', label: 'Payment', render: (r: Invoice) => <StatusBadge status={(r as any).payment_status ?? 'pending'} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: Invoice) => (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setDetailId(r.id)}>View</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPaymentDialogInvoice(r);
              const p = (r as any).payment_status ?? 'pending';
              setPaymentDialogValue(['pending', 'partial', 'paid'].includes(p) ? p : 'pending');
            }}
            title="Change payment status"
          >
            Payment
          </Button>
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
                title="Edit"
              >
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => issueMutation.mutate(r.id)}
                disabled={issueMutation.isPending}
              >
                <FileCheck className="h-4 w-4 mr-1" /> Issue
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)} title="Delete">
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
        title="Invoices"
        subtitle="Generate from confirmed sales orders; issue to finalise"
        onAdd={() => setCreateOpen(true)}
        addLabel="New Invoice"
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="">All payment</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
      </div>
      <DataTableShell<Invoice>
        data={invoices}
        columns={columns}
        searchPlaceholder="Search invoice # or customer..."
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
            <DialogTitle>Create invoice from sales order</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Confirmed / Pick ready / Dispatched sales order</Label>
            <Select value={salesOrderId} onValueChange={setSalesOrderId}>
              <SelectTrigger><SelectValue placeholder="Select order" /></SelectTrigger>
              <SelectContent>
                {orderOptions.map((so) => (
                  <SelectItem key={so.id} value={so.id}>{so.so_number} — {so.customer_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!salesOrderId || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create invoice
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
                <span className="text-muted-foreground">Customer</span>
                <span>{detail.customer_name ?? '—'}</span>
                <span className="text-muted-foreground">Customer GSTIN</span>
                <span>{detail.customer_gstin ?? '—'}</span>
                <span className="text-muted-foreground">Invoice date</span>
                <span>{detail.invoice_date ? new Date(detail.invoice_date).toLocaleDateString() : '—'}</span>
                <span className="text-muted-foreground">Due date</span>
                <span>{detail.due_date ? new Date(detail.due_date).toLocaleDateString() : '—'}</span>
                <span className="text-muted-foreground">Status</span>
                <span><StatusBadge status={detail.status} /></span>
                <span className="text-muted-foreground">Payment status</span>
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
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </span>
                <span className="text-muted-foreground">SO number</span>
                <span>{detail.so_number ?? '—'}</span>
              </div>
              {(detail.billing_address || detail.shipping_address) && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {detail.billing_address && (
                    <>
                      <span className="text-muted-foreground">Billing address</span>
                      <span className="whitespace-pre-wrap">{detail.billing_address}</span>
                    </>
                  )}
                  {detail.shipping_address && (
                    <>
                      <span className="text-muted-foreground">Shipping address</span>
                      <span className="whitespace-pre-wrap">{detail.shipping_address}</span>
                    </>
                  )}
                </div>
              )}
              {detail.notes && (
                <div>
                  <span className="text-muted-foreground block mb-1">Notes</span>
                  <p className="whitespace-pre-wrap">{detail.notes}</p>
                </div>
              )}
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Product</th>
                      <th className="px-4 py-2 text-right font-medium">HSN</th>
                      <th className="px-4 py-2 text-right font-medium">Qty</th>
                      <th className="px-4 py-2 text-right font-medium">Unit price</th>
                      <th className="px-4 py-2 text-right font-medium">Disc %</th>
                      <th className="px-4 py-2 text-right font-medium">Taxable</th>
                      <th className="px-4 py-2 text-right font-medium">GST</th>
                      <th className="px-4 py-2 text-right font-medium">CGST</th>
                      <th className="px-4 py-2 text-right font-medium">SGST</th>
                      <th className="px-4 py-2 text-right font-medium">IGST</th>
                      <th className="px-4 py-2 text-right font-medium">Line total</th>
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
                <div className="flex gap-8"><span className="text-muted-foreground w-32">Sub total</span><span>₹{Number((detail as { sub_total?: number }).sub_total ?? detail.subtotal ?? 0).toLocaleString()}</span></div>
                <div className="flex gap-8"><span className="text-muted-foreground w-32">Discount</span><span>₹{Number(detail.discount_amount ?? 0).toLocaleString()}</span></div>
                <div className="flex gap-8"><span className="text-muted-foreground w-32">CGST</span><span>₹{Number(detail.cgst_amount ?? 0).toLocaleString()}</span></div>
                <div className="flex gap-8"><span className="text-muted-foreground w-32">SGST</span><span>₹{Number(detail.sgst_amount ?? 0).toLocaleString()}</span></div>
                <div className="flex gap-8"><span className="text-muted-foreground w-32">IGST</span><span>₹{Number(detail.igst_amount ?? 0).toLocaleString()}</span></div>
                <div className="flex gap-8 font-medium"><span className="text-muted-foreground w-32">Grand total</span><span>₹{Number(detail.grand_total ?? 0).toLocaleString()}</span></div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id)}
        loading={deleteMutation.isPending}
        title="Delete invoice"
        description="Only draft invoices can be deleted. Are you sure?"
      />

      <Dialog open={!!paymentDialogInvoice} onOpenChange={(open) => !open && setPaymentDialogInvoice(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change payment status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {paymentDialogInvoice && (
              <p className="text-sm text-muted-foreground">
                {paymentDialogInvoice.invoice_number}
              </p>
            )}
            <div className="space-y-2">
              <Label>Payment status</Label>
              <Select
                value={paymentDialogValue}
                onValueChange={(v: 'pending' | 'partial' | 'paid') => setPaymentDialogValue(v)}
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
            <Button variant="outline" onClick={() => setPaymentDialogInvoice(null)}>Cancel</Button>
            <Button
              onClick={() =>
                paymentDialogInvoice &&
                updatePaymentMutation.mutate({ id: paymentDialogInvoice.id, payment_status: paymentDialogValue })
              }
              disabled={!paymentDialogInvoice || updatePaymentMutation.isPending}
            >
              {updatePaymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingInvoice} onOpenChange={(open) => !open && setEditingInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input
                type="date"
                value={editForm.due_date}
                onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Billing address</Label>
              <Textarea
                value={editForm.billing_address}
                onChange={(e) => setEditForm((f) => ({ ...f, billing_address: e.target.value }))}
                placeholder="Billing address"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Shipping address</Label>
              <Textarea
                value={editForm.shipping_address}
                onChange={(e) => setEditForm((f) => ({ ...f, shipping_address: e.target.value }))}
                placeholder="Shipping address"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInvoice(null)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
