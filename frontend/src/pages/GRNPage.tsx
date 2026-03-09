import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { grnApi } from '@/api/grnApi';
import { vendorApi } from '@/api/vendorApi';
import { warehouseApi } from '@/api/warehouseApi';
import type { GRN } from '@/types/grn.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { CrudFormDialog, FieldDef } from '@/components/shared/CrudFormDialog';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

export default function GRNPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    sortBy: 'created_at',
    sortOrder: 'DESC' as const,
  };

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', { limit: 500 }],
    queryFn: () => vendorApi.getAll({ limit: 500 }),
  });
  const vendors = vendorsData?.data ?? [];

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses', { limit: 500 }],
    queryFn: () => warehouseApi.getAll({ limit: 500 }),
  });
  const warehouses = warehousesData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['grns', listParams],
    queryFn: () => grnApi.getAll(listParams),
  });

  const grns: GRN[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      applySearch(value);
    },
    [applySearch]
  );

  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));
  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));

  const fields: FieldDef[] = [
    { key: 'vendor_id', label: 'Vendor', type: 'select', required: true, options: vendorOptions },
    { key: 'warehouse_id', label: 'Warehouse', type: 'select', required: true, options: warehouseOptions },
    { key: 'receipt_date', label: 'Receipt Date', type: 'date', required: true },
    { key: 'invoice_number', label: 'Invoice Number', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];

  const createMutation = useMutation({
    mutationFn: async (fd: Record<string, unknown>) => {
      // Backend expects camelCase and receiptDate
      const payload = {
        vendorId: String(fd.vendor_id),
        warehouseId: String(fd.warehouse_id),
        receiptDate: fd.receipt_date ? String(fd.receipt_date) : new Date().toISOString().slice(0, 10),
        invoiceNumber: fd.invoice_number ? String(fd.invoice_number) : undefined,
        notes: fd.notes ? String(fd.notes) : undefined,
        items: [] as Array<{
          product_id: string;
          ordered_qty_boxes: number;
          received_qty_boxes: number;
          unit_cost: number;
          gst_rate: number;
        }>,
      };
      const res = await grnApi.create(payload as { vendorId: string; warehouseId: string; receiptDate: string; invoiceNumber?: string; notes?: string; items: Array<{ product_id: string; ordered_qty_boxes: number; received_qty_boxes: number; unit_cost: number; gst_rate: number }> });
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grns'] });
      setDialogOpen(false);
      toast.success('GRN created');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      const msg =
        e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Create failed';
      toast.error(msg);
    },
  });

  const columns = [
    {
      key: 'grn_number',
      label: 'GRN #',
      render: (r: GRN) => <span className="font-mono text-sm font-medium">{r.grn_number}</span>,
    },
    { key: 'vendor_name', label: 'Vendor', render: (r: GRN) => r.vendor_name ?? '—' },
    { key: 'warehouse_name', label: 'Warehouse', render: (r: GRN) => r.warehouse_name ?? '—' },
    { key: 'status', label: 'Status', render: (r: GRN) => <StatusBadge status={r.status} /> },
    {
      key: 'receipt_date',
      label: 'Date',
      render: (r: GRN) => {
        const dateStr = r.receipt_date ?? r.received_date;
        return dateStr ? new Date(dateStr).toLocaleDateString('en-IN') : '—';
      },
    },
    { key: 'invoice_number', label: 'Invoice #', render: (r: GRN) => r.invoice_number ?? '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: GRN) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(`/purchase/grn/${r.id}`)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Goods Receipt Notes"
        subtitle="Manage goods receipt"
        onAdd={() => setDialogOpen(true)}
        addLabel="New GRN"
      />

      <DataTableShell<GRN>
        data={grns}
        columns={columns}
        searchKey="grn_number"
        searchPlaceholder="Search by GRN # or vendor..."
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      <CrudFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={(d) => createMutation.mutateAsync(d)}
        fields={fields}
        title="New GRN"
        initialData={null}
        loading={createMutation.isPending}
      />
    </div>
  );
}
