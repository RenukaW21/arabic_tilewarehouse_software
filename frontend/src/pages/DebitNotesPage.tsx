import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorApi } from '@/api/vendorApi';
import { purchaseReturnApi } from '@/api/miscApi';
import { debitNotesApi, type DebitNote } from '@/api/notesApi';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CrudFormDialog, FieldDef } from '@/components/shared/CrudFormDialog';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DebitNotesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DebitNote | null>(null);
  const [deleting, setDeleting] = useState<DebitNote | null>(null);

  const { data: vendorsRes } = useQuery({
    queryKey: ['vendors-active'],
    queryFn: () => vendorApi.getAll({ limit: 500, is_active: true }),
  });
  const { data: prResponse } = useQuery({
    queryKey: ['purchase-returns', 'dropdown'],
    queryFn: () => purchaseReturnApi.getAll({ page: 1, limit: 500, sortBy: 'created_at', sortOrder: 'DESC' }),
  });

  const vendors = vendorsRes?.data ?? [];
  const purchaseReturns = (prResponse?.data ?? []) as any[];

  const { data: notesRes, isLoading } = useQuery({
    queryKey: ['debit_notes'],
    queryFn: () => debitNotesApi.getAll({ page: 1, limit: 500, sortBy: 'created_at', sortOrder: 'DESC' }),
  });
  const items: DebitNote[] = notesRes?.data ?? [];

  const fields: FieldDef[] = [
    { key: 'dn_number', label: 'Debit Note #', type: 'text', required: true, placeholder: 'DN-2025-0001' },
    { key: 'vendor_id', label: 'Vendor', type: 'select', required: true, options: vendors.map((v) => ({ value: v.id, label: v.name })) },
    { key: 'purchase_return_id', label: 'Purchase Return (optional)', type: 'select', options: purchaseReturns.map((p) => ({ value: p.id, label: p.return_number })) },
    { key: 'amount', label: 'Amount (₹)', type: 'number', required: true, defaultValue: 0 },
    { key: 'dn_date', label: 'Issue Date', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'draft', label: 'Draft' }, { value: 'issued', label: 'Issued' }, { value: 'acknowledged', label: 'Acknowledged' }, { value: 'settled', label: 'Settled' }], defaultValue: 'draft' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];

  const saveMutation = useMutation({
    mutationFn: async (fd: Record<string, unknown>) => {
      const payload: Partial<DebitNote> = {
        dn_number: String(fd.dn_number),
        vendor_id: String(fd.vendor_id),
        purchase_return_id: fd.purchase_return_id && fd.purchase_return_id !== 'none' ? String(fd.purchase_return_id) : null,
        amount: Number(fd.amount || 0),
        dn_date: fd.dn_date ? String(fd.dn_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        status: String(fd.status || 'draft') as any,
        notes: fd.notes ? String(fd.notes) : null,
        created_by: user?.id as any,
      };
      if (editing) return debitNotesApi.update(editing.id, payload);
      return debitNotesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debit_notes'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? 'Debit note updated!' : 'Debit note created!');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? e.message ?? 'Operation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => debitNotesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debit_notes'] });
      setDeleting(null);
      toast.success('Debit note deleted!');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? e.message ?? 'Delete failed'),
  });

  const getVendorName = (vendorId: string) => vendors.find((v) => v.id === vendorId)?.name ?? '—';
  const getPRNumber = (prId: string | null | undefined) =>
    prId ? purchaseReturns.find((p) => p.id === prId)?.return_number ?? '—' : '—';

  const columns = [
    { key: 'dn_number', label: 'DN #', render: (r: DebitNote) => <span className="font-mono text-sm font-medium">{r.dn_number}</span> },
    { key: 'vendor', label: 'Vendor', render: (r: DebitNote) => getVendorName(r.vendor_id) },
    { key: 'pr', label: 'Return #', render: (r: DebitNote) => getPRNumber(r.purchase_return_id) },
    { key: 'amount', label: 'Amount', render: (r: DebitNote) => `₹${Number(r.amount || 0).toLocaleString()}` },
    { key: 'dn_date', label: 'Date', render: (r: DebitNote) => (r.dn_date ? new Date(r.dn_date).toLocaleDateString() : '—') },
    { key: 'status', label: 'Status', render: (r: DebitNote) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', label: 'Actions', render: (r: DebitNote) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )
    },
  ];

  return (
    <div>
      <PageHeader title="Debit Notes" subtitle="Manage debit notes for vendors" onAdd={() => { setEditing(null); setDialogOpen(true); }} addLabel="New Debit Note" />
      {isLoading ? <p className="text-muted-foreground">Loading...</p> : <DataTableShell data={items as any[]} columns={columns as any[]} searchKey="dn_number" searchPlaceholder="Search DN#..." />}
      <CrudFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSubmit={(d) => saveMutation.mutateAsync(d).then(() => { })}
        fields={fields}
        title={editing ? 'Edit Debit Note' : 'New Debit Note'}
        initialData={editing ? { ...editing, purchase_return_id: editing.purchase_return_id ?? 'none' } : undefined}
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
