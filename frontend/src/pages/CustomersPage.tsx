import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerApi } from "@/api/customerApi";
import type { Customer, CreateCustomerDto } from "@/types/customer.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const fields: FieldDef[] = [
  { key: "name", label: "Customer Name", type: "text", required: true, placeholder: "Enter customer name" },
  { key: "code", label: "Customer Code", type: "text", placeholder: "CUST-001" },
  { key: "contact_person", label: "Contact Person", type: "text", placeholder: "Contact name" },
  { key: "phone", label: "Phone", type: "text", placeholder: "Phone number" },
  { key: "email", label: "Email", type: "email", placeholder: "Email address" },
  { key: "gstin", label: "GSTIN", type: "text", placeholder: "22AAAAA0000A1Z5" },
  { key: "state_code", label: "State Code", type: "text", placeholder: "e.g. 09" },
  { key: "billing_address", label: "Billing Address", type: "textarea", placeholder: "Billing address" },
  { key: "shipping_address", label: "Shipping Address", type: "textarea", placeholder: "Shipping address" },
  { key: "credit_limit", label: "Credit Limit (₹)", type: "number", defaultValue: 0, placeholder: "0" },
  { key: "payment_terms_days", label: "Payment Terms (Days)", type: "number", defaultValue: 0, placeholder: "0" },
  { key: "is_active", label: "Status", type: "switch", defaultValue: true },
];

export default function CustomersPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    sortBy: "created_at" as const,
    sortOrder: "DESC" as const,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["customers", listParams],
    queryFn: () => customerApi.getAll(listParams),
  });

  const customers: Customer[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    applySearch(value);
  }, [applySearch]);

  const saveMutation = useMutation({
    mutationFn: async (fd: Record<string, unknown>) => {
      const payload: CreateCustomerDto = {
        name: String(fd.name),
        code: fd.code ? String(fd.code) : null,
        contact_person: fd.contact_person ? String(fd.contact_person) : null,
        phone: fd.phone ? String(fd.phone) : null,
        email: fd.email ? String(fd.email) : null,
        gstin: fd.gstin ? String(fd.gstin) : null,
        state_code: fd.state_code ? String(fd.state_code) : null,
        billing_address: fd.billing_address ? String(fd.billing_address) : null,
        shipping_address: fd.shipping_address ? String(fd.shipping_address) : null,
        credit_limit: fd.credit_limit != null && fd.credit_limit !== "" ? Number(fd.credit_limit) : null,
        payment_terms_days: fd.payment_terms_days != null && fd.payment_terms_days !== "" ? Number(fd.payment_terms_days) : null,
        is_active: fd.is_active ?? true,
      };
      if (editing) return customerApi.update(editing.id, payload);
      return customerApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? "Customer updated" : "Customer created");
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Operation failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customerApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDeleting(null);
      toast.success("Customer deleted");
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Delete failed");
    },
  });

  const columns = [
    { key: "code", label: "Code", render: (r: Customer) => <span className="font-mono text-sm">{r.code ?? "—"}</span> },
    { key: "name", label: "Customer Name" },
    { key: "contact_person", label: "Contact", render: (r: Customer) => r.contact_person ?? "—" },
    { key: "phone", label: "Phone", render: (r: Customer) => r.phone ?? "—" },
    { key: "credit_limit", label: "Credit Limit", render: (r: Customer) => (r.credit_limit != null ? `₹${Number(r.credit_limit).toLocaleString()}` : "—") },
    { key: "is_active", label: "Status", render: (r: Customer) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    {
      key: "actions",
      label: "Actions",
      render: (r: Customer) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setDialogOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage your customers"
        onAdd={() => { setEditing(null); setDialogOpen(true); }}
        addLabel="Add Customer"
      />
      <DataTableShell<Customer>
        data={customers}
        columns={columns}
        searchKey="name"
        searchPlaceholder="Search by name or code..."
        serverSide
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        paginationMeta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
      />
      <CrudFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSubmit={(d) => saveMutation.mutateAsync(d)}
        fields={fields}
        title={editing ? "Edit Customer" : "New Customer"}
        initialData={editing}
        loading={saveMutation.isPending}
      />
      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
