import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { warehouseApi } from "@/api/warehouseApi";
import type { Warehouse, CreateWarehouseDto } from "@/types/warehouse.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function WarehousesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fields: FieldDef[] = [
    { key: "name", label: t('warehouses.warehouseName'), type: "text", required: true, placeholder: t('sampleData.mainWarehouse') },
    { key: "code", label: t('common.code'), type: "text", required: true, placeholder: t('sampleData.whMain') },
    { key: "address", label: t('vendors.address'), type: "textarea", placeholder: t('sampleData.enterAddress') },
    { key: "city", label: t('common.city'), type: "text", placeholder: t('sampleData.city') },
    { key: "state", label: t('common.state'), type: "text", placeholder: t('sampleData.state') },
    { key: "pincode", label: t('common.pincode'), type: "text", placeholder: t('sampleData.pincode') },
    { key: "is_active", label: t('common.status'), type: "switch", defaultValue: true },
  ];

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    sortBy: "created_at" as const,
    sortOrder: "DESC" as const,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["warehouses", listParams],
    queryFn: () => warehouseApi.getAll(listParams),
  });

  const warehouses: Warehouse[] = data?.data ?? [];
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
      const payload: any = {
        name: fd.name ? String(fd.name) : undefined,
        code: fd.code ? String(fd.code) : undefined,
        address: fd.address ? String(fd.address) : null,
        city: fd.city ? String(fd.city) : null,
        state: fd.state ? String(fd.state) : null,
        pincode: fd.pincode ? String(fd.pincode) : null,
        is_active: fd.is_active ?? true,
      };
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
      if (editing) return warehouseApi.update(editing.id, payload);
      return warehouseApi.create(payload as CreateWarehouseDto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? t('warehouses.warehouseUpdated') : t('warehouses.warehouseCreated'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => warehouseApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      setDeleting(null);
      toast.success(t('warehouses.warehouseDeleted'));
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Delete failed");
    },
  });

  const columns = [
    { key: "code", label: t('common.code'), render: (r: Warehouse) => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: "name", label: t('common.name') },
    { key: "city", label: "City", render: (r: Warehouse) => r.city ?? "—" },
    { key: "rack_count", label: t('nav.racks'), render: (r: Warehouse) => <span className="font-medium">{r.rack_count ?? 0}</span> },
    { key: "is_active", label: t('common.status'), render: (r: Warehouse) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    {
      key: "actions",
      label: t('common.actions'),
      render: (r: Warehouse) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => navigate(`/setup/warehouses/${r.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
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
        title={t('warehouses.title')}
        subtitle={t('warehouses.subtitle')}
        onAdd={() => { setEditing(null); setDialogOpen(true); }}
        addLabel={t('warehouses.addWarehouse')}
      />
      <DataTableShell<any>
        data={warehouses}
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
        onSubmit={async (d) => { await saveMutation.mutateAsync(d); }}
        fields={fields}
        title={editing ? t('warehouses.editWarehouse') : t('warehouses.newWarehouse')}
        initialData={editing as any}
        loading={saveMutation.isPending}
      />
      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => { if (deleting) await deleteMutation.mutateAsync(deleting.id); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
