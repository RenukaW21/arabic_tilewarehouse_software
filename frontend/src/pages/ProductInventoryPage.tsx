import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rackInventoryApi, rackApi, warehouseApi } from "@/api/warehouseApi";
import { productApi } from "@/api/productApi";
import { inventoryApi } from "@/api/inventoryApi";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Wand2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";

export default function ProductInventoryPage() {
    const qc = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [autoDialogOpen, setAutoDialogOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
    const [listWarehouseId, setListWarehouseId] = useState<string>("all");
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

    const listParams = {
        page,
        limit: 25,
        search: search.trim() || undefined,
        warehouse_id: listWarehouseId !== "all" ? listWarehouseId : undefined,
        sortBy: "updated_at" as const,
        sortOrder: "DESC" as const,
    };

    // Reset selected warehouse/product when dialog closes
    useEffect(() => {
        if (!dialogOpen && !autoDialogOpen) {
            setSelectedWarehouseId(null);
            setSelectedProductId(null);
        } else if (editing) {
            setSelectedWarehouseId(editing.warehouse_id);
            setSelectedProductId(editing.product_id);
        }
    }, [dialogOpen, autoDialogOpen, editing]);

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

    // Fetch total stock for selected product (from stock_summary)
    const { data: stockData } = useQuery({
        queryKey: ["inventory-stock", selectedProductId],
        queryFn: () => inventoryApi.getStockList({ limit: 1000, page: 1 } as any),
        enabled: !!selectedProductId && (dialogOpen || autoDialogOpen),
        staleTime: 10_000,
    });

    // Fetch already-stored boxes for selected product in product_racks
    const { data: assignedData } = useQuery({
        queryKey: ["productInventory-all", selectedProductId],
        queryFn: () => api.get(`/rack-inventory?limit=1000`).then(r => r.data),
        enabled: !!selectedProductId && (dialogOpen || autoDialogOpen),
        staleTime: 10_000,
    });

    // Compute available stock for the selected product
    const { totalStock, alreadyStored, availableToStore } = (() => {
        if (!selectedProductId) return { totalStock: null, alreadyStored: 0, availableToStore: null };

        const stockRows: any[] = stockData?.data ?? [];
        const totalStock = stockRows
            .filter((r: any) => r.product_id === selectedProductId)
            .reduce((sum: number, r: any) => sum + (parseFloat(r.total_boxes) || 0), 0);

        const assignedRows: any[] = assignedData?.data ?? [];
        const alreadyStored = assignedRows
            .filter((r: any) => {
                if (r.product_id !== selectedProductId) return false;
                // Exclude current editing entry
                if (editing && r.id === editing.id) return false;
                return true;
            })
            .reduce((sum: number, r: any) => sum + (parseFloat(r.boxes_stored) || 0), 0);

        return {
            totalStock,
            alreadyStored,
            availableToStore: Math.max(0, totalStock - alreadyStored),
        };
    })();

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
            const boxesStored = Number(fd.boxes_stored);

            // Client-side stock validation
            if (availableToStore !== null && boxesStored > availableToStore) {
                throw new Error(
                    `Cannot store more than available stock. ` +
                    `Available: ${availableToStore} boxes (Stock: ${totalStock}, Already stored: ${alreadyStored}).`
                );
            }

            const payload = {
                id: editing?.id,
                product_id: String(fd.product_id),
                rack_id: String(fd.rack_id),
                boxes_stored: boxesStored,
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
            toast.error(e?.message ?? e?.response?.data?.error?.message ?? "Operation failed");
        },
    });

    const autoAllocateMutation = useMutation({
        mutationFn: async (fd: Record<string, unknown>) => {
            const boxesNeeded = Number(fd.boxes_needed);
            
            if (availableToStore !== null && boxesNeeded > availableToStore) {
                throw new Error(`Cannot store more than available stock.`);
            }

            const payload = {
                product_id: String(fd.product_id),
                warehouse_id: String(fd.warehouse_id),
                boxes_needed: boxesNeeded,
                allow_split: fd.allow_split === true || fd.allow_split === 'true',
            };
            return rackApi.autoAllocate(payload);
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["productInventory"] });
            qc.invalidateQueries({ queryKey: ["racks"] });
            qc.invalidateQueries({ queryKey: ["products"] });
            setAutoDialogOpen(false);
            
            // Format success message with allocations
            const allocations = data?.data?.allocations;
            if (allocations && allocations.length > 0) {
                const parts = allocations.map((a: any) => `${a.boxes} box(es) in ${a.rackName}`).join(", ");
                toast.success(`Allocated successfully: ${parts}`);
            } else {
                toast.success("Product auto-allocated successfully");
            }
        },
        onError: (e: any) => {
            toast.error(e?.message ?? e?.response?.data?.error?.message ?? "Auto-allocation failed");
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

    // Build helper text for boxes_stored field
    const boxesHelperText = selectedProductId && availableToStore !== null
        ? `Max: ${availableToStore} boxes  |  Stock: ${totalStock},  Already stored: ${alreadyStored}`
        : undefined;

    const formFields: FieldDef[] = [
        { key: "product_id", label: "Product", type: "combobox", required: true, options: productOptions },
        { key: "warehouse_id", label: "Warehouse", type: "select", required: true, options: warehouseOptions },
        { key: "rack_id", label: "Rack", type: "select", required: true, options: rackOptions, placeholder: selectedWarehouseId ? "Select Rack..." : "Select Warehouse First" },
        {
            key: "boxes_stored",
            label: "Boxes Stored",
            type: "number",
            required: true,
            placeholder: availableToStore !== null ? `Max ${availableToStore}` : "0",
            ...(boxesHelperText ? { description: boxesHelperText } : {}),
        },
    ];

    return (
        <div>
            <PageHeader
                title="Product Inventory"
                subtitle="Manage product storage across racks"
                onAdd={() => {
                    setEditing(null);
                    setSelectedWarehouseId(listWarehouseId !== "all" ? listWarehouseId : null);
                    setDialogOpen(true);
                }}
                addLabel="Allocate Product"
            >
                <div className="flex items-center gap-2 mr-2">
                    <Select value={listWarehouseId} onValueChange={(val) => { setListWarehouseId(val); setPage(1); }}>
                        <SelectTrigger className="w-[180px] h-9">
                            <SelectValue placeholder="All Warehouses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Warehouses</SelectItem>
                            {warehouseOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setEditing(null);
                        setSelectedWarehouseId(listWarehouseId !== "all" ? listWarehouseId : null);
                        setAutoDialogOpen(true);
                    }}
                    className="flex items-center gap-1.5"
                >
                    <Wand2 className="h-4 w-4 text-purple-600" />
                    Auto Allocate
                </Button>
            </PageHeader>

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
                values={editing ? undefined : { warehouse_id: selectedWarehouseId }}
                loading={saveMutation.isPending}
                onValueChange={(key, val) => {
                    if (key === "warehouse_id") setSelectedWarehouseId(val);
                    if (key === "product_id") setSelectedProductId(val);
                }}
            />

            <CrudFormDialog
                open={autoDialogOpen}
                onClose={() => setAutoDialogOpen(false)}
                onSubmit={(d) => autoAllocateMutation.mutateAsync(d)}
                fields={[
                    { key: "product_id", label: "Product", type: "combobox", required: true, options: productOptions },
                    { key: "warehouse_id", label: "Warehouse", type: "select", required: true, options: warehouseOptions },
                    {
                        key: "boxes_needed",
                        label: "Boxes to Allocate",
                        type: "number",
                        required: true,
                        placeholder: availableToStore !== null ? `Max ${availableToStore}` : "1",
                        ...(boxesHelperText ? { description: boxesHelperText } : {}),
                    },
                    {
                        key: "allow_split",
                        label: "Allow splitting across multiple racks",
                        type: "switch",
                        defaultValue: true,
                        description: "If no single rack can hold all boxes, automatically divide them into multiple available racks.",
                    }
                ]}
                title="Auto-Allocate Product"
                loading={autoAllocateMutation.isPending}
                onValueChange={(key, val) => {
                    if (key === "warehouse_id") setSelectedWarehouseId(val);
                    if (key === "product_id") setSelectedProductId(val);
                }}
            />
        </div>
    );
}

