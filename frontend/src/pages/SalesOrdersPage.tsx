import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  salesOrdersApi,
  type SalesOrder,
  type CreateSalesOrderDto,
} from '@/api/salesApi';
import { customerApi } from '@/api/customerApi';
import { warehouseApi } from '@/api/warehouseApi';
import { productApi } from '@/api/productApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { OrderFormDialog } from '@/components/shared/OrderFormDialog';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { FieldDef } from '@/components/shared/CrudFormDialog';
import type { LineItem } from '@/components/shared/LineItemsEditor';
import { useAuth } from '@/hooks/useAuth';
import { can, type UserRole } from '@/lib/permissions';

export default function SalesOrdersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canCreate = can((user?.role as UserRole) ?? undefined, 'sales-orders', 'create');
  const canUpdate = can((user?.role as UserRole) ?? undefined, 'sales-orders', 'update');
  const canDelete = can((user?.role as UserRole) ?? undefined, 'sales-orders', 'delete');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SalesOrder | null>(null);
  const [editingItems, setEditingItems] = useState<LineItem[]>([]);
  const [deleting, setDeleting] = useState<SalesOrder | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');
  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    payment_status: paymentFilter || undefined,
    sortBy: 'order_date',
    sortOrder: 'DESC' as const,
  };

  const { data: customersRes } = useQuery({
    queryKey: ['customers-active'],
    queryFn: () => customerApi.getAll({ limit: 500, is_active: true }),
  });
  const { data: warehousesRes } = useQuery({
    queryKey: ['warehouses-active'],
    queryFn: () => warehouseApi.getAll({ limit: 500 }),
  });
  const { data: productsRes } = useQuery({
    queryKey: ['products-active'],
    queryFn: () => productApi.getAll({ limit: 500 }),
  });
  const customers = customersRes?.data ?? [];
  const warehouses = warehousesRes?.data ?? [];
  const products = productsRes?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', listParams],
    queryFn: () => salesOrdersApi.getAll(listParams),
  });
  const orders: SalesOrder[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const statusReopenOptions: FieldDef[] =
    editing?.status === 'cancelled'
      ? [{ key: 'status', label: 'Reopen as status', type: 'select', required: false, options: [{ value: 'pick_ready', label: 'Pick Ready' }, { value: 'confirmed', label: 'Confirmed' }], defaultValue: 'pick_ready' }]
      : [];
  const headerFields: FieldDef[] = [
    ...statusReopenOptions,
    { key: 'customer_id', label: 'Customer', type: 'select', required: true, options: customers.map((c) => ({ value: c.id, label: c.name })) },
    { key: 'warehouse_id', label: 'Warehouse', type: 'select', required: true, options: warehouses.map((w) => ({ value: w.id, label: w.name })) },
    { key: 'order_date', label: 'Order Date', type: 'date', required: true },
    { key: 'expected_delivery_date', label: 'Expected Delivery', type: 'date' },
    { key: 'payment_status', label: 'Payment Status', type: 'select', required: false, options: [{ value: 'pending', label: 'Pending' }, { value: 'partial', label: 'Partial' }, { value: 'paid', label: 'Paid' }], defaultValue: 'pending' },
    { key: 'delivery_address', label: 'Delivery Address', type: 'textarea' },
    { key: 'discount_amount', label: 'Discount (₹)', type: 'number', defaultValue: 0 },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];

  const buildPayload = (header: Record<string, unknown>, items: LineItem[]): CreateSalesOrderDto & { status?: string } => ({
    customerId: String(header.customer_id),
    warehouseId: String(header.warehouse_id),
    orderDate: header.order_date ? String(header.order_date).slice(0, 10) : undefined,
    expectedDeliveryDate: header.expected_delivery_date ? String(header.expected_delivery_date).slice(0, 10) : null,
    paymentStatus: (header.payment_status === 'partial' || header.payment_status === 'paid') ? header.payment_status : 'pending',
    deliveryAddress: header.delivery_address ? String(header.delivery_address) : null,
    discountAmount: Number(header.discount_amount) || 0,
    notes: header.notes ? String(header.notes) : null,
    ...(editing?.status === 'cancelled' && header.status && ['pick_ready', 'confirmed'].includes(String(header.status)) ? { status: String(header.status) } : {}),
    items: items
      .filter((i) => i.product_id)
      .map((i) => ({
        productId: i.product_id,
        shadeId: i.shade_id ?? null,
        orderedBoxes: i.ordered_boxes,
        orderedPieces: i.ordered_pieces ?? 0,
        unitPrice: i.unit_price,
        discountPct: i.discount_pct ?? 0,
        taxPct: i.tax_pct ?? 18,
      })),
  });

  const handleEdit = async (row: SalesOrder) => {
    setEditing(row);
    const full = await salesOrdersApi.getById(row.id);
    const orderData = full?.data ?? row;
    const items: LineItem[] = (orderData.items ?? []).map((i: SalesOrder['items'][0]) => ({
      id: i.id,
      product_id: i.product_id,
      shade_id: i.shade_id ?? null,
      ordered_boxes: Number(i.ordered_boxes),
      unit_price: Number(i.unit_price),
      discount_pct: Number(i.discount_pct ?? 0),
      tax_pct: Number(i.tax_pct ?? 18),
      line_total: Number(i.line_total ?? 0),
    }));
    setEditingItems(items.length ? items : [{ product_id: '', shade_id: null, ordered_boxes: 1, unit_price: 0, discount_pct: 0, tax_pct: 18, line_total: 0 }]);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async ({ header, items }: { header: Record<string, unknown>; items: LineItem[] }) => {
      const payload = buildPayload(header, items);
      if (editing) return salesOrdersApi.update(editing.id, payload);
      return salesOrdersApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
      setDialogOpen(false);
      setEditing(null);
      setEditingItems([]);
      toast.success(editing ? 'Order updated' : 'Order created');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Operation failed'),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => salesOrdersApi.confirm(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Order confirmed; pick list created');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Confirm failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      salesOrdersApi.remove(id).then(() => ({ status })),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
      setDeleting(null);
      toast.success(status === 'draft' ? 'Order deleted' : 'Order cancelled');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed'),
  });

  const columns = [
    { key: 'so_number', label: 'SO #', render: (r: SalesOrder) => <span className="font-mono text-sm font-medium">{r.so_number}</span> },
    { key: 'customer_name', label: 'Customer', render: (r: SalesOrder) => r.customer_name ?? '—' },
    { key: 'warehouse_name', label: 'Warehouse', render: (r: SalesOrder) => r.warehouse_name ?? '—' },
    { key: 'status', label: 'Status', render: (r: SalesOrder) => <StatusBadge status={r.status} /> },
    { key: 'order_date', label: 'Date', render: (r: SalesOrder) => (r.order_date ? new Date(r.order_date).toLocaleDateString() : '—') },
    { key: 'grand_total', label: 'Total', render: (r: SalesOrder) => `₹${Number(r.grand_total ?? 0).toLocaleString()}` },
    { key: 'payment_status', label: 'Payment', render: (r: SalesOrder) => <StatusBadge status={r.payment_status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: SalesOrder) => (
        <div className="flex gap-1">
          {canUpdate && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(r)} title={r.status === 'draft' ? 'Edit order' : r.status === 'cancelled' ? 'Reopen or edit' : 'Edit delivery/notes'}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canCreate && r.status === 'draft' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600"
              onClick={() => confirmMutation.mutate(r.id)}
              disabled={confirmMutation.isPending}
              title="Confirm order"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)} title={r.status === 'draft' ? 'Delete order' : 'Cancel order'}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        subtitle="Manage sales orders"
        onAdd={canCreate ? () => { setEditing(null); setEditingItems([]); setDialogOpen(true); } : undefined}
        addLabel="New SO"
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="pick_ready">Pick Ready</option>
          <option value="dispatched">Dispatched</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => {
            setPaymentFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="">All payment</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
      </div>
      <DataTableShell<SalesOrder>
        data={orders}
        columns={columns}
        searchPlaceholder="Search SO # or customer..."
        serverSide
        searchValue={searchInput}
        onSearchChange={(v) => {
          setSearchInput(v);
          applySearch(v);
        }}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />
      <OrderFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
          setEditingItems([]);
        }}
        onSubmit={(header, items) => saveMutation.mutateAsync({ header, items })}
        headerFields={headerFields}
        title={editing ? 'Edit Sales Order' : 'New Sales Order'}
        initialData={editing ? { ...editing, so_number: editing.so_number, ...(editing.status === 'cancelled' ? { status: 'pick_ready' } : {}) } : undefined}
        initialItems={editingItems}
        loading={saveMutation.isPending}
        products={products}
      />
      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => deleting && deleteMutation.mutate({ id: deleting.id, status: deleting.status })}
        title={deleting?.status === 'draft' ? 'Delete order' : 'Cancel order'}
        description={deleting?.status === 'draft' ? 'This will permanently remove the draft order. Continue?' : 'This will mark the order as cancelled. Continue?'}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
