import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrderApi } from '@/api/miscApi';
import type { PurchaseOrder } from '@/types/misc.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { POCreateEditDialog } from '@/components/shared/POCreateEditDialog';
import { vendorApi } from '@/api/vendorApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';

export default function PurchaseOrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: poRes, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => purchaseOrderApi.getById(id!),
    enabled: !!id,
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', { limit: 500 }],
    queryFn: () => vendorApi.getAll({ limit: 500 }),
  });
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses', { limit: 500 }],
    queryFn: () => warehouseApi.getAll({ limit: 500 }),
  });
  const { data: productsData } = useQuery({
    queryKey: ['products', { limit: 500 }],
    queryFn: () => productApi.getAll({ page: 1, limit: 500 }),
  });

  const vendors = vendorsData?.data ?? [];
  const warehouses = warehousesData?.data ?? [];
  const productsList = productsData?.data ?? [];
  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));
  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));
  const products = productsList.map((p) => ({
    id: p.id,
    code: p.code ?? '',
    name: p.name,
    mrp: p.mrp ?? null,
    gst_rate: p.gstRate ?? 18,
  }));

  const approveMutation = useMutation({
    mutationFn: () => purchaseOrderApi.approve(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders', id] });
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('PO approved');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? 'Approve failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => purchaseOrderApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setDeleteOpen(false);
      toast.success('PO cancelled');
      navigate('/purchase/orders');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? 'Cancel failed');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof purchaseOrderApi.update>[1]) => purchaseOrderApi.update(id!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders', id] });
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setEditOpen(false);
      toast.success('PO updated');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? 'Update failed');
    },
  });

  const po: PurchaseOrder | undefined = poRes?.data;

  if (!id) return <div className="p-4 text-destructive">Missing PO ID</div>;
  if (isLoading || !poRes) return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (error || !po) return <div className="p-4 text-destructive">Purchase order not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/purchase/orders')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
        </Button>
      </div>
      <PageHeader
        title={po.po_number}
        subtitle="Purchase order details"
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={po.status} />
        {po.status === 'draft' && (
          <>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Cancel PO
            </Button>
          </>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-muted-foreground">Vendor</span><p className="font-medium">{po.vendor_name ?? po.vendor_id}</p></div>
          <div><span className="text-muted-foreground">Warehouse</span><p className="font-medium">{po.warehouse_name ?? po.warehouse_id}</p></div>
          <div><span className="text-muted-foreground">Order Date</span><p className="font-medium">{po.order_date ? new Date(po.order_date).toLocaleDateString() : '—'}</p></div>
          <div><span className="text-muted-foreground">Expected Date</span><p className="font-medium">{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}</p></div>
          <div className="col-span-2"><span className="text-muted-foreground">Notes</span><p className="font-medium">{po.notes || '—'}</p></div>
          <div><span className="text-muted-foreground">Grand Total</span><p className="font-medium">₹{Number(po.grand_total ?? 0).toLocaleString()}</p></div>
        </div>
      </div>

      <div className="rounded-lg border">
        <h3 className="px-4 py-2 border-b bg-muted/50 text-sm font-semibold">Line Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2 font-medium">Product</th>
                <th className="text-right px-4 py-2 font-medium">Ordered</th>
                <th className="text-right px-4 py-2 font-medium">Received</th>
                <th className="text-right px-4 py-2 font-medium">Unit Price</th>
                <th className="text-right px-4 py-2 font-medium">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {(po.items ?? []).map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="px-4 py-2">{item.product_name ?? item.product_code ?? item.product_id}</td>
                  <td className="px-4 py-2 text-right">{item.ordered_boxes}</td>
                  <td className="px-4 py-2 text-right">{item.received_boxes ?? 0}</td>
                  <td className="px-4 py-2 text-right">₹{Number(item.unit_price).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">₹{Number(item.line_total ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!po.items || po.items.length === 0) && (
          <p className="px-4 py-6 text-center text-muted-foreground">No line items</p>
        )}
      </div>

      <POCreateEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={(d) => updateMutation.mutateAsync(d)}
        loading={updateMutation.isPending}
        vendors={vendorOptions}
        warehouses={warehouseOptions}
        products={products}
        initial={po}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutateAsync()}
        loading={deleteMutation.isPending}
        title="Cancel Purchase Order?"
        description="This will cancel the PO. You cannot cancel if a GRN exists for this PO."
      />
    </div>
  );
}
