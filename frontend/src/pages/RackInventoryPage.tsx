import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rackInventoryApi, rackApi } from "@/api/warehouseApi";
import { productApi } from "@/api/productApi";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function RackInventoryPage() {
    const qc = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");

    const listParams = {
        page,
        limit: 25,
        search: search.trim() || undefined,
        sortBy: "updated_at" as const,
        sortOrder: "DESC" as const,
    };

    const { data: productsData } = useQuery({
        queryKey: ["products", { limit: 1000 }],
        queryFn: () => productApi.getAll({ limit: 1000 }),
    });

    const { data: racksData } = useQuery({
        queryKey: ["racks", { limit: 1000 }],
        queryFn: () => rackApi.getAll({ limit: 1000 }),
    });

    const productOptions =
        productsData?.data?.map((p: any) => ({
            value: p.id,
            label: `${p.code} - ${p.name}`,
        })) ?? [];

    const rackOptions =
        racksData?.data?.map((r: any) => ({
            value: r.id,
            label: `${r.name} [${r.warehouse_name || 'N/A'}] (${r.available_boxes ?? r.capacity_boxes ?? 0} avail)`,
        })) ?? [];

    const { data, isLoading } = useQuery({
        queryKey: ["rackInventory", listParams],
        queryFn: () => rackInventoryApi.getAll(listParams),
    });

    const inventory: any[] = data?.data ?? [];
    const meta = data?.meta ?? null;

    const handleSearchChange = useCallback((value: string) => {
        setSearchInput(value);
        setSearch(value);
        setPage(1);
    }, []);

    const saveMutation = useMutation({
        mutationFn: async (fd: Record<string, unknown>) => {
            const payload = {
                product_id: String(fd.product_id),
                rack_id: String(fd.rack_id),
                boxes_stored: Number(fd.boxes_stored),
            };
            return rackApi.assignProduct(payload);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["rackInventory"] });
            // Invalidating related cache could be wise if we're showing sum on other pages
            qc.invalidateQueries({ queryKey: ["racks"] });
            qc.invalidateQueries({ queryKey: ["products"] });
            setDialogOpen(false);
            setEditing(null);
            toast.success(editing ? "Rack entry updated" : "Rack allocated successfully");
        },
        onError: (e: any) => {
            toast.error(e?.response?.data?.error?.message ?? "Operation failed");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (row: any) => {
            // Set to 0 boxes or run a custom endpoint.
            // Easiest is to send an assignProduct with 0 boxes stored to effectively "delete/clear" it
            // if our backend repository handles 0 by removing the row (like we do when clearing racks).
            // Or we can just use a dedicated API. We don't have delete currently on rackInventory route.
            // So let's delete using a raw call because there's no API defined yet for delete product_rack.
            const res = await api.delete(`/rack-inventory/${row.product_id}/${row.rack_id}`);
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["rackInventory"] });
            qc.invalidateQueries({ queryKey: ["products"] });
            qc.invalidateQueries({ queryKey: ["racks"] });
            toast.success("Rack assignment removed");
        },
        onError: (e: any) => {
            toast.error(e?.response?.data?.error?.message ?? "Failed to delete");
        },
    });

    const columns = [
        { key: "product", label: "Product", render: (r: any) => `${r.product_code} - ${r.product_name}` },
        { key: "rack_name", label: "Rack", render: (r: any) => r.rack_name },
        { key: "warehouse_name", label: "Warehouse", render: (r: any) => r.warehouse_name },
        { key: "boxes_stored", label: "Boxes Stored", render: (r: any) => r.boxes_stored },
        {
            key: "actions",
            label: "Actions",
            render: (r: any) => (
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            setEditing(r);
                            setDialogOpen(true);
                        }}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                            if (confirm('Are you sure you want to remove this rack assignment?')) {
                                deleteMutation.mutate(r);
                            }
                        }}
                        disabled={deleteMutation.isPending}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    const formFields: FieldDef[] = [
        { key: "product_id", label: "Product", type: "combobox", required: true, options: productOptions },
        { key: "rack_id", label: "Rack", type: "select", required: true, options: rackOptions },
        { key: "boxes_stored", label: "Boxes Stored", type: "number", required: true, placeholder: "0" },
    ];

    return (
        <div>
            <PageHeader
                title="Rack Inventory"
                subtitle="Manage product storage across racks"
                onAdd={() => {
                    setEditing(null);
                    setDialogOpen(true);
                }}
                addLabel="Allocate Rack"
            />

            <DataTableShell<any>
                data={inventory}
                columns={columns}
                searchKey="search"
                searchPlaceholder="Search product or rack..."
                serverSide
                searchValue={searchInput}
                onSearchChange={handleSearchChange}
                paginationMeta={meta}
                onPageChange={setPage}
                isLoading={isLoading}
            />

            <CrudFormDialog
                open={dialogOpen}
                onClose={() => {
                    setDialogOpen(false);
                    setEditing(null);
                }}
                onSubmit={(d) => saveMutation.mutateAsync(d)}
                fields={formFields}
                title={editing ? "Update Rack Entry" : "Allocate Rack"}
                initialData={editing}
                loading={saveMutation.isPending}
            />
        </div>
    );
}
