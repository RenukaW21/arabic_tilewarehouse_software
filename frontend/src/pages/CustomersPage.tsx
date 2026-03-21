import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerApi } from "@/api/customerApi";
import type { Customer, CreateCustomerDto } from "@/types/customer.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { CsvImportDialog } from "@/components/shared/CsvImportDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, FileUp } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function CustomersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const fields: FieldDef[] = [
    { key: "name", label: t('customers.customerName'), type: "text", required: true, placeholder: "Enter customer name" },
    { key: "code", label: t('common.code'), type: "text", placeholder: "CUST-001" },
    { key: "contact_person", label: t('customers.contactPerson'), type: "text", placeholder: "Contact name" },
    { key: "phone", label: t('customers.phone'), type: "text", placeholder: "Phone number" },
    { key: "email", label: t('customers.email'), type: "email", placeholder: "Email address" },
    { key: "gstin", label: t('customers.gstNumber'), type: "text", placeholder: "22AAAAA0000A1Z5" },
    { key: "state_code", label: "State Code", type: "text", placeholder: "e.g. 09" },
    { key: "billing_address", label: "Billing Address", type: "textarea", placeholder: "Billing address" },
    { key: "shipping_address", label: "Shipping Address", type: "textarea", placeholder: "Shipping address" },
    { key: "credit_limit", label: "Credit Limit (₹)", type: "number", defaultValue: 0, placeholder: "0" },
    { key: "payment_terms_days", label: "Payment Terms (Days)", type: "number", defaultValue: 0, placeholder: "0" },
    { key: "is_active", label: t('common.status'), type: "switch", defaultValue: true },
  ];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
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
        is_active: Boolean(fd.is_active ?? true),
      };
      if (editing) return customerApi.update(editing.id, payload);
      return customerApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? t('customers.customerUpdated') : t('customers.customerCreated'));
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
      toast.success(t('customers.customerDeleted'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Delete failed");
    },
  });

  const columns = [
    { key: "code", label: t('common.code'), render: (r: Customer) => <span className="font-mono text-sm">{r.code ?? "—"}</span> },
    { key: "name", label: t('customers.customerName') },
    { key: "contact_person", label: t('customers.contactPerson'), render: (r: Customer) => r.contact_person ?? "—" },
    { key: "phone", label: t('customers.phone'), render: (r: Customer) => r.phone ?? "—" },
    { key: "credit_limit", label: "Credit Limit", render: (r: Customer) => (r.credit_limit != null ? `₹${Number(r.credit_limit).toLocaleString()}` : "—") },
    { key: "is_active", label: t('common.status'), render: (r: Customer) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    {
      key: "actions",
      label: t('common.actions'),
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
        title={t('customers.title')}
        subtitle={t('customers.subtitle')}
        onAdd={() => { setEditing(null); setDialogOpen(true); }}
        addLabel={t('customers.addCustomer')}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCsvImportOpen(true)}
          className="flex items-center gap-1.5"
        >
          <FileUp className="h-4 w-4" />
          {t('common.importCsv')}
        </Button>
      </PageHeader>
      <DataTableShell<Customer>
        data={customers}
        columns={columns}
        searchKey="name"
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
        title={editing ? t('customers.editCustomer') : t('customers.newCustomer')}
        initialData={editing}
        loading={saveMutation.isPending}
      />
      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => { if (deleting) await deleteMutation.mutateAsync(deleting.id); }}
        loading={deleteMutation.isPending}
      />
      
      <CsvImportDialog
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        title="Bulk Import Customers via CSV"
        description="Upload a CSV file to import multiple customers at once."
        entityName="customer(s)"
        queryKeyToInvalidate="customers"
        requiredColumns={["name"]}
        optionalColumns={["code", "contact_person", "phone", "email", "billing_address", "shipping_address", "gstin", "state_code", "credit_limit", "payment_terms_days", "is_active"]}
        templateHeaders={["name", "code", "contact_person", "phone", "email", "billing_address", "shipping_address", "gstin", "state_code", "credit_limit", "payment_terms_days", "is_active"]}
        sampleRow={"Acme Corp,CUST-001,John Doe,1234567890,john@acme.com,123 Billing St,456 Shipping Ave,22AAAAA0000A1Z5,22,50000,30,true"}
        importMutationFn={(file: File) => customerApi.importCsv(file)}
      />
    </div>
  );
}
