import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrderApi } from '@/api/miscApi';
import { vendorApi } from '@/api/vendorApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import type { PurchaseOrder, CreatePODto } from '@/types/misc.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { POCreateEditDialog } from '@/components/shared/POCreateEditDialog';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [deleting, setDeleting] = useState<PurchaseOrder | null>(null);
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

  const { data: productsData } = useQuery({
    queryKey: ['products', { limit: 500 }],
    queryFn: () => productApi.getAll({ page: 1, limit: 500 }),
  });
  const productsList = productsData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', listParams],
    queryFn: () => purchaseOrderApi.getAll(listParams),
  });

  const orders: PurchaseOrder[] = data?.data ?? [];
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
  const products = productsList.map((p) => ({
    id: p.id,
    code: p.code ?? '',
    name: p.name,
    mrp: p.mrp ?? null,
    gst_rate: p.gstRate ?? 18,
  }));

  const saveMutation = useMutation({
    mutationFn: async (payload: CreatePODto) => {
      if (editing) {
        const res = await purchaseOrderApi.update(editing.id, payload);
        return res.data;
      }
      const res = await purchaseOrderApi.create(payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? 'PO updated' : 'PO created');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      const msg =
        e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Operation failed';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => purchaseOrderApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setDeleting(null);
      toast.success('PO cancelled');
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      const msg =
        e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Delete failed';
      toast.error(msg);
    },
  });

  const getVendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? '—';
  const getWarehouseName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? '—';

  const columns = [
    {
      key: 'po_number',
      label: 'PO #',
      render: (r: PurchaseOrder) => (
        <button
          type="button"
          className="font-mono text-sm font-medium text-primary hover:underline"
          onClick={() => navigate(`/purchase/orders/${r.id}`)}
        >
          {r.po_number}
        </button>
      ),
    },
    { key: 'vendor', label: 'Vendor', render: (r: PurchaseOrder) => r.vendor_name ?? getVendorName(r.vendor_id) },
    { key: 'warehouse', label: 'Warehouse', render: (r: PurchaseOrder) => r.warehouse_name ?? getWarehouseName(r.warehouse_id) },
    { key: 'status', label: 'Status', render: (r: PurchaseOrder) => <StatusBadge status={r.status} /> },
    {
      key: 'order_date',
      label: 'Order Date',
      render: (r: PurchaseOrder) =>
        r.order_date ? new Date(r.order_date).toLocaleDateString('en-IN') : '—',
    },
    {
      key: 'grand_total',
      label: 'Total',
      render: (r: PurchaseOrder) => `₹${Number(r.grand_total ?? 0).toLocaleString()}`,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: PurchaseOrder) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(`/purchase/orders/${r.id}`)}
            title="View"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {/* {r.status === 'draft' && ( */}
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setEditing(r);
                  setDialogOpen(true);
                }}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => setDeleting(r)}
                title="Cancel PO"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          {/* )} */}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage purchase orders"
        onAdd={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
        addLabel="New PO"
      />

      <DataTableShell<PurchaseOrder>
        data={orders}
        columns={columns}
        searchKey="po_number"
        searchPlaceholder="Search by PO #..."
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      <POCreateEditDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSubmit={(d) => saveMutation.mutateAsync(d)}
        loading={saveMutation.isPending}
        vendors={vendorOptions}
        warehouses={warehouseOptions}
        products={products}
        initial={editing ?? undefined}
      />

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => (deleting ? deleteMutation.mutateAsync(deleting.id) : Promise.resolve())}
        loading={deleteMutation.isPending}
        title="Cancel Purchase Order?"
        description="This will cancel the PO. It cannot be undone. You cannot cancel if GRN exists."
      />
    </div>
  );
}
