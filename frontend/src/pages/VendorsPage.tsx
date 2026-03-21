import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorApi } from "@/api/vendorApi";
import type { Vendor, CreateVendorDto } from "@/types/vendor.types";
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

export default function VendorsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState<Vendor | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fields: FieldDef[] = [
    { key: "name", label: t('vendors.vendorName'), type: "text", required: true, placeholder: t('sampleData.enterName') },
    { key: "code", label: t('common.code'), type: "text", placeholder: t('sampleData.vnd001') },
    { key: "contact_person", label: t('vendors.contactPerson'), type: "text", placeholder: t('sampleData.enterContact') },
    { key: "phone", label: t('vendors.phone'), type: "text", placeholder: t('sampleData.enterPhone') },
    { key: "email", label: t('vendors.email'), type: "email", placeholder: t('sampleData.enterEmail') },
    { key: "gstin", label: t('vendors.gstNumber'), type: "text", placeholder: t('sampleData.gstin') },
    { key: "pan", label: "PAN", type: "text", placeholder: t('sampleData.pan') },
    { key: "address", label: t('vendors.address'), type: "textarea", placeholder: t('sampleData.enterAddress') },
    { key: "payment_terms_days", label: "Payment Terms (Days)", type: "number", defaultValue: 30 },
    { key: "is_active", label: t('common.status'), type: "switch", defaultValue: true },
  ];

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
        is_active: Boolean(fd.is_active ?? true),
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
      toast.success(editing ? t('vendors.vendorUpdated') : t('vendors.vendorCreated'));
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Operation failed";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vendorApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setDeleting(null);
      toast.success(t('vendors.vendorDeleted'));
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Delete failed";
      toast.error(msg);
    },
  });

  const columns = [
    { key: "code", label: t('common.code'), render: (r: Vendor) => <span className="font-mono text-sm">{r.code ?? "—"}</span> },
    { key: "name", label: t('vendors.vendorName') },
    { key: "contact_person", label: t('vendors.contactPerson'), render: (r: Vendor) => r.contact_person ?? "—" },
    { key: "phone", label: t('vendors.phone'), render: (r: Vendor) => r.phone ?? "—" },
    { key: "gstin", label: t('vendors.gstNumber'), render: (r: Vendor) => r.gstin ?? "—" },
    { key: "is_active", label: t('common.status'), render: (r: Vendor) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    {
      key: "actions",
      label: t('common.actions'),
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
        title={t('vendors.title')}
        subtitle={t('vendors.subtitle')}
        onAdd={() => { setEditing(null); setDialogOpen(true); }}
        addLabel={t('vendors.addVendor')}
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

      <DataTableShell<Vendor>
        data={vendors}
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
        title={editing ? t('vendors.editVendor') : t('vendors.newVendor')}
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
        title={t('sampleData.importVendorsTitle')}
        description={t('sampleData.importVendorsDesc')}
        entityName={t('nav.vendors').toLowerCase()}
        queryKeyToInvalidate="vendors"
        requiredColumns={["name"]}
        optionalColumns={["code", "contact_person", "phone", "email", "address", "gstin", "pan", "payment_terms_days", "is_active"]}
        templateHeaders={["name", "code", "contact_person", "phone", "email", "address", "gstin", "pan", "payment_terms_days", "is_active"]}
        sampleRow={`${t('sampleData.acmeCorp')},${t('sampleData.vnd001')},${t('sampleData.johnDoe')},1234567890,john@acme.com,${t('sampleData.address1')},22AAAAA0000A1Z5,ABCDE1234F,30,true`}
        importMutationFn={(file: File) => vendorApi.importCsv(file)}
      />
    </div>
  );
}
