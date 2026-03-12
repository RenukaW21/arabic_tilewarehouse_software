import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rackInventoryApi, rackApi, warehouseApi } from "@/api/warehouseApi";
import { productApi } from "@/api/productApi";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function ProductInventoryPage() {
    const qc = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

    const listParams = {
        page,
        limit: 25,
        search: search.trim() || undefined,
        sortBy: "updated_at" as const,
        sortOrder: "DESC" as const,
    };

    // Reset selected warehouse when dialog closes
    useEffect(() => {
        if (!dialogOpen) {
            setSelectedWarehouseId(null);
        } else if (editing) {
            setSelectedWarehouseId(editing.warehouse_id);
        }
    }, [dialogOpen, editing]);

    const { data: productsData } = useQuery({
        queryKey: ["products", { limit: 1000 }],
        queryFn: () => productApi.getAll({ limit: 1000 }),
    });

    const { data: warehousesData } = useQuery({
        queryKey: ["warehouses", { limit: 1000 }],
        queryFn: () => warehouseApi.getAll({ limit: 1000 }),
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

    const warehouseOptions =
        warehousesData?.data?.map((w: any) => ({
            value: w.id,
            label: `${w.name} (${w.code})`,
        })) ?? [];

    const rackOptions =
        racksData?.data
            ?.filter((r: any) => {
                const isWarehouseMatch = !selectedWarehouseId || r.warehouse_id === selectedWarehouseId;
                const isNotFull = (r.available_boxes ?? 0) > 0;
                // If editing, allow the current rack even if full (though it shouldn't be full if we're looking at it, but safer)
                const isCurrentRack = editing && r.id === editing.rack_id;
                return isWarehouseMatch && (isNotFull || isCurrentRack);
            })
            .map((r: any) => ({
                value: r.id,
                label: `${r.name} (${r.available_boxes ?? r.capacity_boxes ?? 0} avail)`,
            })) ?? [];

    const { data, isLoading } = useQuery({
        queryKey: ["productInventory", listParams],
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
                id: editing?.id,
                product_id: String(fd.product_id),
                rack_id: String(fd.rack_id),
                boxes_stored: Number(fd.boxes_stored),
            };
            return rackApi.assignProduct(payload);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["productInventory"] });
            qc.invalidateQueries({ queryKey: ["racks"] });
            qc.invalidateQueries({ queryKey: ["products"] });
            setDialogOpen(false);
            setEditing(null);
            toast.success(editing ? "Product inventory updated" : "Product allocated successfully");
        },
        onError: (e: any) => {
            toast.error(e?.response?.data?.error?.message ?? "Operation failed");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (row: any) => {
            const res = await api.delete(`/rack-inventory/${row.product_id}/${row.rack_id}`);
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["productInventory"] });
            qc.invalidateQueries({ queryKey: ["products"] });
            qc.invalidateQueries({ queryKey: ["racks"] });
            toast.success("Product assignment removed");
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
                            if (confirm('Are you sure you want to remove this product assignment?')) {
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
        { key: "warehouse_id", label: "Warehouse", type: "select", required: true, options: warehouseOptions },
        { key: "rack_id", label: "Rack", type: "select", required: true, options: rackOptions, placeholder: selectedWarehouseId ? "Select Rack..." : "Select Warehouse First" },
        { key: "boxes_stored", label: "Boxes Stored", type: "number", required: true, placeholder: "0" },
    ];

    return (
        <div>
            <PageHeader
                title="Product Inventory"
                subtitle="Manage product storage across racks"
                onAdd={() => {
                    setEditing(null);
                    setDialogOpen(true);
                }}
                addLabel="Allocate Product"
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
                title={editing ? "Update Product Entry" : "Allocate Product"}
                initialData={editing}
                loading={saveMutation.isPending}
                onValueChange={(key, val) => {
                    if (key === "warehouse_id") {
                        setSelectedWarehouseId(val);
                    }
                }}
            />
        </div>
    );
}
