import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { warehouseApi } from "@/api/warehouseApi";
import type { Warehouse, CreateWarehouseDto } from "@/types/warehouse.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const fields: FieldDef[] = [
  { key: "name", label: "Warehouse Name", type: "text", required: true, placeholder: "Main Warehouse" },
  { key: "code", label: "Code", type: "text", required: true, placeholder: "WH-MAIN" },
  { key: "address", label: "Address", type: "textarea", placeholder: "Full address" },
  { key: "city", label: "City", type: "text", placeholder: "City" },
  { key: "state", label: "State", type: "text", placeholder: "State" },
  { key: "pincode", label: "Pincode", type: "text", placeholder: "Pincode" },
  { key: "is_active", label: "Status", type: "switch", defaultValue: true },
];

export default function WarehousesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);
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
      const payload: CreateWarehouseDto = {
        name: String(fd.name),
        code: String(fd.code),
        address: fd.address ? String(fd.address) : null,
        city: fd.city ? String(fd.city) : null,
        state: fd.state ? String(fd.state) : null,
        pincode: fd.pincode ? String(fd.pincode) : null,
        is_active: fd.is_active ?? true,
      };
      if (editing) return warehouseApi.update(editing.id, payload);
      return warehouseApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? "Warehouse updated" : "Warehouse created");
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Operation failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => warehouseApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      setDeleting(null);
      toast.success("Warehouse deleted");
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } } }) => {
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Delete failed");
    },
  });

  const columns = [
    { key: "code", label: "Code", render: (r: Warehouse) => <span className="font-mono text-sm font-medium">{r.code}</span> },
    { key: "name", label: "Name" },
    { key: "city", label: "City", render: (r: Warehouse) => r.city ?? "—" },
    { key: "state", label: "State", render: (r: Warehouse) => r.state ?? "—" },
    { key: "is_active", label: "Status", render: (r: Warehouse) => <StatusBadge status={r.is_active ? "active" : "inactive"} /> },
    {
      key: "actions",
      label: "Actions",
      render: (r: Warehouse) => (
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
        title="Warehouses"
        subtitle="Manage warehouse locations"
        onAdd={() => { setEditing(null); setDialogOpen(true); }}
        addLabel="Add Warehouse"
      />
      <DataTableShell<Warehouse>
        data={warehouses}
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
        title={editing ? "Edit Warehouse" : "New Warehouse"}
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
