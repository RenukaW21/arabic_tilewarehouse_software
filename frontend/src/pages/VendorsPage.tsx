import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorApi } from "@/api/vendorApi";
import type { Vendor, CreateVendorDto } from "@/types/vendor.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const fields: FieldDef[] = [
  { key: "name", label: "Vendor Name", type: "text", required: true, placeholder: "Enter vendor name" },
  { key: "code", label: "Vendor Code", type: "text", placeholder: "VND-001" },
  { key: "contact_person", label: "Contact Person", type: "text", placeholder: "Enter contact person name" },
  { key: "phone", label: "Phone", type: "text", placeholder: "Enter phone number" },
  { key: "email", label: "Email", type: "email", placeholder: "Enter email address" },
  { key: "gstin", label: "GSTIN", type: "text", placeholder: "22AAAAA0000A1Z5" },
  { key: "pan", label: "PAN", type: "text", placeholder: "ABCDE1234F" },
  { key: "address", label: "Address", type: "textarea", placeholder: "Enter vendor address" },
  { key: "payment_terms_days", label: "Payment Terms (Days)", type: "number", defaultValue: 30, placeholder: "Enter payment terms in days" },
  { key: "is_active", label: "Status", type: "switch", defaultValue: true },
];

export default function VendorsPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState<Vendor | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  // Sync search to API (optionally debounce in future)
  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    sortBy: "created_at" as const,
    sortOrder: "DESC" as const,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["vendors", listParams],
    queryFn: () => vendorApi.getAll(listParams),
  });

  const vendors: Vendor[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    applySearch(value);
  }, [applySearch]);

  const saveMutation = useMutation({
    mutationFn: async (fd: Record<string, unknown>) => {
      const payload: CreateVendorDto = {
        name: String(fd.name),
        code: fd.code ? String(fd.code) : null,
        contact_person: fd.contact_person ? String(fd.contact_person) : null,
        phone: fd.phone ? String(fd.phone) : null,
        email: fd.email ? String(fd.email) : null,
        gstin: fd.gstin ? String(fd.gstin) : null,
        pan: fd.pan ? String(fd.pan) : null,
        address: fd.address ? String(fd.address) : null,
        payment_terms_days: Number(fd.payment_terms_days) || 30,
        is_active: fd.is_active ?? true,
      };
      if (editing) {
        return vendorApi.update(editing.id, payload);
      }
      return vendorApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? "Vendor updated" : "Vendor created");
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Operation failed";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vendorApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setDeleting(null);
      toast.success("Vendor deleted");
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Delete failed";
      toast.error(msg);
    },
  });

  const columns = [
    { key: "code", label: "Code", render: (r: Vendor) => <span className="font-mono text-sm">{r.code ?? "—"}</span> },
    { key: "name", label: "Vendor Name" },
    { key: "contact_person", label: "Contact Person", render: (r: Vendor) => r.contact_person ?? "—" },
    { key: "phone", label: "Phone", render: (r: Vendor) => r.phone ?? "—" },
    { key: "gstin", label: "GSTIN", render: (r: Vendor) => r.gstin ?? "—" },
    { key: "is_active", label: "Status", render: (r: Vendor) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    {
      key: "actions",
      label: "Actions",
      render: (r: Vendor) => (
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
        title="Vendors"
        subtitle="Manage your tile suppliers"
        onAdd={() => { setEditing(null); setDialogOpen(true); }}
        addLabel="Add Vendor"
      />

      <DataTableShell<Vendor>
        data={vendors}
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
        title={editing ? "Edit Vendor" : "New Vendor"}
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
