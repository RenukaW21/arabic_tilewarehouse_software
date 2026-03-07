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

export default function PaymentsMadePage() {
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
    { key: 'payment_number', label: 'Payment #', type: 'text', required: true, placeholder: 'PAY-2025-0001' },
    { key: 'vendor_id', label: 'Vendor', type: 'select', required: true, options: vendors.map((v) => ({ value: v.id, label: v.name })) },
    { key: 'purchase_order_id', label: 'Purchase Order', type: 'select', options: purchaseOrders.map((p) => ({ value: p.id, label: p.po_number })) },
    { key: 'amount', label: 'Amount', type: 'number', required: true, defaultValue: 0 },
    { key: 'payment_date', label: 'Payment Date', type: 'date' },
    { key: 'payment_mode', label: 'Mode', type: 'select', options: [{ value: 'cash', label: 'Cash' }, { value: 'cheque', label: 'Cheque' }, { value: 'neft', label: 'NEFT' }, { value: 'rtgs', label: 'RTGS' }, { value: 'upi', label: 'UPI' }, { value: 'other', label: 'Other' }], defaultValue: 'neft' },
    { key: 'reference_number', label: 'Reference #', type: 'text' },
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
      toast.success(editing ? 'Updated' : 'Created');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Operation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vendorPaymentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-payments'] });
      setDeleting(null);
      toast.success('Deleted');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed'),
  });

  const getVendorName = (vendorId: string) => vendors.find((v) => v.id === vendorId)?.name ?? '—';
  const getPONumber = (poId: string | null | undefined) =>
    poId ? purchaseOrders.find((p) => p.id === poId)?.po_number ?? '—' : '—';

  const columns = [
    { key: 'payment_number', label: 'Payment #', render: (r: VendorPayment) => <span className="font-mono text-sm font-medium">{r.payment_number}</span> },
    { key: 'vendor_id', label: 'Vendor', render: (r: VendorPayment) => getVendorName(r.vendor_id) },
    { key: 'purchase_order_id', label: 'PO #', render: (r: VendorPayment) => getPONumber(r.purchase_order_id) },
    { key: 'amount', label: 'Amount', render: (r: VendorPayment) => `₹${Number(r.amount || 0).toLocaleString()}` },
    { key: 'payment_date', label: 'Date', render: (r: VendorPayment) => (r.payment_date ? new Date(r.payment_date).toLocaleDateString() : '—') },
    { key: 'payment_mode', label: 'Mode', render: (r: VendorPayment) => <StatusBadge status={r.payment_mode} /> },
    {
      key: 'actions',
      label: 'Actions',
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
      <PageHeader title="Payments Made" subtitle="Track payments to vendors" onAdd={() => { setEditing(null); setDialogOpen(true); }} addLabel="New Payment" />
      {isLoading ? <p className="text-muted-foreground">Loading...</p> : <DataTableShell data={items as any[]} columns={columns as any[]} searchKey="payment_number" searchPlaceholder="Search payment#..." />}
      <CrudFormDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); }} onSubmit={(d) => saveMutation.mutateAsync(d).then(() => { })} fields={fields} title={editing ? 'Edit Payment' : 'New Payment Made'} initialData={editing ? { ...editing, purchase_order_id: editing.purchase_order_id ?? '' } : undefined} loading={saveMutation.isPending} />
      <DeleteConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id).then(() => { })} loading={deleteMutation.isPending} />
    </div>
  );
}
