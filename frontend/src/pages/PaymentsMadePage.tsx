import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorApi } from '@/api/vendorApi';
import { purchaseOrderApi } from '@/api/miscApi';
import { vendorPaymentsApi, type VendorPayment } from '@/api/paymentsApi';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CrudFormDialog, FieldDef } from '@/components/shared/CrudFormDialog';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function PaymentsMadePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VendorPayment | null>(null);
  const [deleting, setDeleting] = useState<VendorPayment | null>(null);

  const { data: vendorsRes } = useQuery({
    queryKey: ['vendors-active'],
    queryFn: () => vendorApi.getAll({ limit: 500, is_active: true }),
  });
  const { data: poResponse } = useQuery({
    queryKey: ['purchase-orders', 'dropdown'],
    queryFn: () => purchaseOrderApi.getAll({ page: 1, limit: 200, sortBy: 'created_at', sortOrder: 'DESC' }),
  });
  const vendors = vendorsRes?.data ?? [];
  const purchaseOrders = (poResponse?.data ?? []) as { id: string; po_number: string }[];

  const { data: paymentsRes, isLoading } = useQuery({
    queryKey: ['vendor-payments'],
    queryFn: () => vendorPaymentsApi.getAll({ page: 1, limit: 500, sortBy: 'payment_date', sortOrder: 'DESC' }),
  });
  const items: VendorPayment[] = paymentsRes?.data ?? [];

  const fields: FieldDef[] = [
    { key: 'payment_number', label: t('paymentsMade.paymentHash'), type: 'text', required: true, placeholder: 'PAY-2025-0001' },
    { key: 'vendor_id', label: t('paymentsMade.vendor'), type: 'select', required: true, options: vendors.map((v) => ({ value: v.id, label: v.name })) },
    { key: 'purchase_order_id', label: t('paymentsMade.poHash'), type: 'select', options: purchaseOrders.map((p) => ({ value: p.id, label: p.po_number })) },
    { key: 'amount', label: t('paymentsMade.amount'), type: 'number', required: true, defaultValue: 0 },
    { key: 'payment_date', label: t('paymentsMade.date'), type: 'date' },
    { key: 'payment_mode', label: t('paymentsMade.mode'), type: 'select', options: [{ value: 'cash', label: 'Cash' }, { value: 'cheque', label: 'Cheque' }, { value: 'neft', label: 'NEFT' }, { value: 'rtgs', label: 'RTGS' }, { value: 'upi', label: 'UPI' }, { value: 'other', label: 'Other' }], defaultValue: 'neft' },
    { key: 'reference_number', label: t('common.referenceHash', 'مرجع #'), type: 'text' },
  ];

  const saveMutation = useMutation({
    mutationFn: async (fd: Record<string, unknown>) => {
      const payload = {
        payment_number: String(fd.payment_number),
        vendor_id: String(fd.vendor_id),
        purchase_order_id: fd.purchase_order_id && fd.purchase_order_id !== 'none' ? String(fd.purchase_order_id) : null,
        amount: Number(fd.amount || 0),
        payment_date: fd.payment_date ? String(fd.payment_date).slice(0, 10) : null,
        payment_mode: String(fd.payment_mode || 'neft'),
        reference_number: fd.reference_number ? String(fd.reference_number) : null,
        created_by: user?.id,
      };
      if (editing) return vendorPaymentsApi.update(editing.id, payload);
      return vendorPaymentsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-payments'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? t('paymentsMade.updated') : t('paymentsMade.created'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? t('common.operationFailed', 'فشلت العملية')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vendorPaymentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-payments'] });
      setDeleting(null);
      toast.success(t('paymentsMade.deleted'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? t('common.deleteFailed', 'فشل الحذف')),
  });

  const getVendorName = (vendorId: string) => vendors.find((v) => v.id === vendorId)?.name ?? '—';
  const getPONumber = (poId: string | null | undefined) =>
    poId ? purchaseOrders.find((p) => p.id === poId)?.po_number ?? '—' : '—';

  const columns = [
    { key: 'payment_number', label: t('paymentsMade.paymentHash'), render: (r: VendorPayment) => <span className="font-mono text-sm font-medium">{r.payment_number}</span> },
    { key: 'vendor_id', label: t('paymentsMade.vendor'), render: (r: VendorPayment) => getVendorName(r.vendor_id) },
    { key: 'purchase_order_id', label: t('paymentsMade.poHash'), render: (r: VendorPayment) => getPONumber(r.purchase_order_id) },
    { key: 'tile_details', label: t('paymentsMade.tileDetails'), render: (r: VendorPayment) => <span className="text-muted-foreground text-xs truncate max-w-[200px] inline-block" title={r.tile_details || '—'}>{r.tile_details || '—'}</span> },
    { key: 'amount', label: t('paymentsMade.amount'), render: (r: VendorPayment) => `₹${Number(r.amount || 0).toLocaleString()}` },
    { key: 'payment_date', label: t('paymentsMade.date'), render: (r: VendorPayment) => (r.payment_date ? new Date(r.payment_date).toLocaleDateString() : '—') },
    { key: 'payment_mode', label: t('paymentsMade.mode'), render: (r: VendorPayment) => <StatusBadge status={r.payment_mode} /> },
    {
      key: 'actions',
      label: t('paymentsMade.actions'),
      render: (r: VendorPayment) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('paymentsMade.title')} subtitle={t('paymentsMade.subtitle')} onAdd={() => { setEditing(null); setDialogOpen(true); }} addLabel={t('paymentsMade.newPayment')} />
      {isLoading ? <p className="text-muted-foreground">{t('common.loading', 'جار التحميل...')}</p> : <DataTableShell data={items as any[]} columns={columns as any[]} searchKey="payment_number" searchPlaceholder={t('paymentsMade.searchPlaceholder')} />}
      <CrudFormDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); }} onSubmit={(d) => saveMutation.mutateAsync(d).then(() => { })} fields={fields} title={editing ? t('paymentsMade.editPayment') : t('paymentsMade.newPayment')} initialData={editing ? { ...editing, purchase_order_id: editing.purchase_order_id ?? '' } : undefined} loading={saveMutation.isPending} />
      <DeleteConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id).then(() => { })} loading={deleteMutation.isPending} />
    </div>
  );
}
