import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi } from '@/api/customerApi';
import { invoiceApi } from '@/api/invoiceApi';
import { customerPaymentsApi, type CustomerPayment } from '@/api/paymentsApi';
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

export default function PaymentsReceivedPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerPayment | null>(null);
  const [deleting, setDeleting] = useState<CustomerPayment | null>(null);

  const { data: customersRes } = useQuery({
    queryKey: ['customers-active'],
    queryFn: () => customerApi.getAll({ limit: 500, is_active: true }),
  });
  const { data: invoicesRes } = useQuery({
    queryKey: ['invoices-list'],
    queryFn: () => invoiceApi.getAll({ page: 1, limit: 500 }),
  });
  const customers = customersRes?.data ?? [];
  const invoices = (invoicesRes?.data ?? []) as { id: string; invoice_number: string }[];

  const { data: paymentsRes, isLoading } = useQuery({
    queryKey: ['customer-payments'],
    queryFn: () => customerPaymentsApi.getAll({ page: 1, limit: 500, sortBy: 'payment_date', sortOrder: 'DESC' }),
  });
  const items: CustomerPayment[] = paymentsRes?.data ?? [];

  const fields: FieldDef[] = [
    { key: 'payment_number', label: t('paymentsReceived.paymentHash'), type: 'text', required: true, placeholder: 'REC-2025-0001' },
    { key: 'customer_id', label: t('paymentsReceived.customer'), type: 'select', required: true, options: customers.map((c) => ({ value: c.id, label: c.name })) },
    { key: 'invoice_id', label: t('paymentsReceived.invoice'), type: 'select', options: invoices.map((i) => ({ value: i.id, label: i.invoice_number })) },
    { key: 'amount', label: t('paymentsReceived.amount'), type: 'number', required: true, defaultValue: 0 },
    { key: 'payment_date', label: t('paymentsReceived.date'), type: 'date' },
    { key: 'payment_mode', label: t('paymentsReceived.mode'), type: 'select', options: [{ value: 'cash', label: 'Cash' }, { value: 'cheque', label: 'Cheque' }, { value: 'neft', label: 'NEFT' }, { value: 'rtgs', label: 'RTGS' }, { value: 'upi', label: 'UPI' }, { value: 'other', label: 'Other' }], defaultValue: 'cash' },
    { key: 'reference_number', label: t('common.referenceHash', 'مرجع #'), type: 'text' },
  ];

  const saveMutation = useMutation({
    mutationFn: async (fd: Record<string, unknown>) => {
      const payload = {
        payment_number: String(fd.payment_number),
        customer_id: String(fd.customer_id),
        invoice_id: fd.invoice_id && fd.invoice_id !== 'none' ? String(fd.invoice_id) : null,
        amount: Number(fd.amount || 0),
        payment_date: fd.payment_date ? String(fd.payment_date).slice(0, 10) : null,
        payment_mode: String(fd.payment_mode || 'cash'),
        reference_number: fd.reference_number ? String(fd.reference_number) : null,
        created_by: user?.id,
      };
      if (editing) return customerPaymentsApi.update(editing.id, payload);
      return customerPaymentsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-payments'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? t('paymentsReceived.updated') : t('paymentsReceived.created'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? t('common.operationFailed', 'فشلت العملية')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customerPaymentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-payments'] });
      setDeleting(null);
      toast.success(t('paymentsReceived.deleted'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? t('common.deleteFailed', 'فشل الحذف')),
  });

  const getCustomerName = (customerId: string) => customers.find((c) => c.id === customerId)?.name ?? '—';
  const getInvoiceNumber = (invoiceId: string | null | undefined) =>
    invoiceId ? invoices.find((i) => i.id === invoiceId)?.invoice_number ?? '—' : '—';

  const columns = [
    { key: 'payment_number', label: t('paymentsReceived.paymentHash'), render: (r: CustomerPayment) => <span className="font-mono text-sm font-medium">{r.payment_number}</span> },
    { key: 'customer_id', label: t('paymentsReceived.customer'), render: (r: CustomerPayment) => getCustomerName(r.customer_id) },
    { key: 'invoice_id', label: t('paymentsReceived.invoice'), render: (r: CustomerPayment) => getInvoiceNumber(r.invoice_id) },
    { key: 'tile_details', label: t('paymentsReceived.tileDetails'), render: (r: CustomerPayment) => <span className="text-muted-foreground text-xs truncate max-w-[200px] inline-block" title={r.tile_details || '—'}>{r.tile_details || '—'}</span> },
    { key: 'amount', label: t('paymentsReceived.amount'), render: (r: CustomerPayment) => `₹${Number(r.amount || 0).toLocaleString()}` },
    { key: 'payment_date', label: t('paymentsReceived.date'), render: (r: CustomerPayment) => (r.payment_date ? new Date(r.payment_date).toLocaleDateString() : '—') },
    { key: 'payment_mode', label: t('paymentsReceived.mode'), render: (r: CustomerPayment) => <StatusBadge status={r.payment_mode} /> },
    {
      key: 'actions',
      label: t('paymentsReceived.actions'),
      render: (r: CustomerPayment) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('paymentsReceived.title')} subtitle={t('paymentsReceived.subtitle')} onAdd={() => { setEditing(null); setDialogOpen(true); }} addLabel={t('paymentsReceived.newPayment')} />
      {isLoading ? <p className="text-muted-foreground">{t('common.loading', 'جار التحميل...')}</p> : <DataTableShell data={items as any[]} columns={columns as any[]} searchKey="payment_number" searchPlaceholder={t('paymentsReceived.searchPlaceholder')} />}
      <CrudFormDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); }} onSubmit={(d) => saveMutation.mutateAsync(d).then(() => { })} fields={fields} title={editing ? t('paymentsReceived.editPayment') : t('paymentsReceived.newPayment')} initialData={editing ? { ...editing, invoice_id: editing.invoice_id ?? '' } : undefined} loading={saveMutation.isPending} />
      <DeleteConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id).then(() => { })} loading={deleteMutation.isPending} />
    </div>
  );
}
