import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi } from '@/api/customerApi';
import { invoiceApi } from '@/api/invoiceApi';
import { salesReturnApi } from '@/api/miscApi';
import { creditNotesApi, type CreditNote } from '@/api/notesApi';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CrudFormDialog, FieldDef } from '@/components/shared/CrudFormDialog';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CreditNotesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CreditNote | null>(null);
  const [deleting, setDeleting] = useState<CreditNote | null>(null);

  const { data: customersRes } = useQuery({
    queryKey: ['customers-active'],
    queryFn: () => customerApi.getAll({ limit: 500, is_active: true }),
  });
  const { data: invoicesRes } = useQuery({
    queryKey: ['invoices-list'],
    queryFn: () => invoiceApi.getAll({ page: 1, limit: 500 }),
  });
  const { data: srRes } = useQuery({
    queryKey: ['sr-list'],
    queryFn: () => salesReturnApi.getAll({ page: 1, limit: 500 }),
  });

  const customers = customersRes?.data ?? [];
  const invoices = (invoicesRes?.data ?? []) as any[];
  const salesReturns = (srRes?.data ?? []) as any[];

  const { data: notesRes, isLoading } = useQuery({
    queryKey: ['credit_notes'],
    queryFn: () => creditNotesApi.getAll({ page: 1, limit: 500, sortBy: 'created_at', sortOrder: 'DESC' }),
  });
  const items: CreditNote[] = notesRes?.data ?? [];

  const fields: FieldDef[] = [
    { key: 'cn_number', label: 'Credit Note #', type: 'text', required: true, placeholder: 'CN-2025-0001' },
    { key: 'customer_id', label: 'Customer', type: 'select', required: true, options: customers.map((c) => ({ value: c.id, label: c.name })) },
    { key: 'invoice_id', label: 'Invoice (optional)', type: 'select', options: invoices.map((i) => ({ value: i.id, label: i.invoice_number })) },
    { key: 'sales_return_id', label: 'Sales Return (optional)', type: 'select', options: salesReturns.map((s) => ({ value: s.id, label: s.return_number })) },
    { key: 'amount', label: 'Amount (₹)', type: 'number', required: true, defaultValue: 0 },
    { key: 'cn_date', label: 'Issue Date', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'draft', label: 'Draft' }, { value: 'issued', label: 'Issued' }, { value: 'adjusted', label: 'Adjusted' }, { value: 'cancelled', label: 'Cancelled' }], defaultValue: 'draft' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];

  const saveMutation = useMutation({
    mutationFn: async (fd: Record<string, unknown>) => {
      const payload: Partial<CreditNote> = {
        cn_number: String(fd.cn_number),
        customer_id: String(fd.customer_id),
        invoice_id: fd.invoice_id && fd.invoice_id !== 'none' ? String(fd.invoice_id) : null,
        sales_return_id: fd.sales_return_id && fd.sales_return_id !== 'none' ? String(fd.sales_return_id) : null,
        amount: Number(fd.amount || 0),
        cn_date: fd.cn_date ? String(fd.cn_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        status: String(fd.status || 'draft') as any,
        notes: fd.notes ? String(fd.notes) : null,
        created_by: user?.id as any,
      };
      if (editing) return creditNotesApi.update(editing.id, payload);
      return creditNotesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credit_notes'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? 'Credit note updated!' : 'Credit note created!');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? e.message ?? 'Operation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => creditNotesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credit_notes'] });
      setDeleting(null);
      toast.success('Credit note deleted!');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? e.message ?? 'Delete failed'),
  });

  const getCustomerName = (customerId: string) => customers.find((c) => c.id === customerId)?.name ?? '—';
  const getInvoiceNumber = (invoiceId: string | null | undefined) =>
    invoiceId ? invoices.find((i) => i.id === invoiceId)?.invoice_number ?? '—' : '—';

  const columns = [
    { key: 'cn_number', label: 'CN #', render: (r: CreditNote) => <span className="font-mono text-sm font-medium">{r.cn_number}</span> },
    { key: 'customer', label: 'Customer', render: (r: CreditNote) => getCustomerName(r.customer_id) },
    { key: 'invoice', label: 'Invoice', render: (r: CreditNote) => getInvoiceNumber(r.invoice_id) },
    { key: 'amount', label: 'Amount', render: (r: CreditNote) => `₹${Number(r.amount || 0).toLocaleString()}` },
    { key: 'cn_date', label: 'Date', render: (r: CreditNote) => (r.cn_date ? new Date(r.cn_date).toLocaleDateString() : '—') },
    { key: 'status', label: 'Status', render: (r: CreditNote) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', label: 'Actions', render: (r: CreditNote) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )
    },
  ];

  return (
    <div>
      <PageHeader title="Credit Notes" subtitle="Manage credit notes for customers" onAdd={() => { setEditing(null); setDialogOpen(true); }} addLabel="New Credit Note" />
      {isLoading ? <p className="text-muted-foreground">Loading...</p> : <DataTableShell data={items as any[]} columns={columns as any[]} searchKey="cn_number" searchPlaceholder="Search CN#..." />}
      <CrudFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSubmit={(d) => saveMutation.mutateAsync(d).then(() => { })}
        fields={fields}
        title={editing ? 'Edit Credit Note' : 'New Credit Note'}
        initialData={editing ? { ...editing, invoice_id: editing.invoice_id ?? 'none', sales_return_id: editing.sales_return_id ?? 'none' } : undefined}
        loading={saveMutation.isPending}
      />
      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id).then(() => { })}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
