import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productApi } from "@/api/productApi";
import { getCategories } from "@/api/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const BACKEND_URL = API_BASE.replace(/\/api\/v1\/?$/, '') || 'http://localhost:5000';

export default function ProductsPage() {
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* ===============================
     FETCH PRODUCTS
  =============================== */

  const { data: paged, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => productApi.getAll({ page: 1, limit: 100 }),
  });

  const products = (paged as any)?.data ?? [];

  /* ===============================
     FETCH CATEGORIES
  =============================== */

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  // const categories = (categoryPaged as any)?.data ?? [];

  // console.log(categories)

  /* ===============================
     HANDLE EDIT PREVIEW
  =============================== */

  useEffect(() => {
    if (editing?.imageUrl) {
      setPreviewUrl(`${BACKEND_URL}/${editing.imageUrl}`);
    } else {
      setPreviewUrl(null);
    }
  }, [editing]);

  /* ===============================
     DYNAMIC FIELDS
  =============================== */

  const fields: FieldDef[] = [
    {
      key: "category_id",
      label: "Category",
      type: "select",
      required: true,
      options: categories.map((c: any) => ({
        label: c.name,
        value: c.id,
      })),
    },

    { key: "name", label: "Product Name", type: "text", required: true },
    { key: "code", label: "Product Code", type: "text", required: true },

    { key: "size_label", label: "Size Label", type: "text", required: true },
    {
      key: "size_length_mm",
      label: "Length (mm)",
      type: "number",
      required: true,
    },
    {
      key: "size_width_mm",
      label: "Width (mm)",
      type: "number",
      required: true,
    },
    { key: "size_thickness_mm", label: "Thickness (mm)", type: "number" },

    {
      key: "pieces_per_box",
      label: "Pieces/Box",
      type: "number",
      required: true,
    },
    { key: "sqft_per_box", label: "Sqft/Box", type: "number", required: true },
    { key: "sqmt_per_box", label: "Sqmt/Box", type: "number" },
    { key: "weight_per_box_kg", label: "Weight/Box (Kg)", type: "number" },

    { key: "finish", label: "Finish", type: "text" },
    { key: "material", label: "Material", type: "text" },
    { key: "brand", label: "Brand", type: "text" },

    { key: "hsn_code", label: "HSN Code", type: "text" },
    {
      key: "gst_rate",
      label: "GST Rate (%)",
      type: "number",
      required: true,
      defaultValue: 18,
    },

    { key: "mrp", label: "MRP (₹)", type: "number" },
    {
      key: "reorder_level_boxes",
      label: "Reorder Level (Boxes)",
      type: "number",
      defaultValue: 0,
    },

    { key: "barcode", label: "Barcode", type: "text" },

    { key: "description", label: "Description", type: "textarea" },

    { key: "is_active", label: "Status", type: "switch", defaultValue: true }

    // { key: "image", label: "Tile Image", type: "file" },
  ];

  /* ===============================
     SAVE PRODUCT
  =============================== */

  const saveMutation = useMutation({
    mutationFn: async (formData: Record<string, unknown>) => {
      const data = new FormData();

      data.append("categoryId", String(formData.category_id ?? ""));
      data.append("name", String(formData.name ?? ""));
      data.append("code", String(formData.code ?? ""));
      data.append("description", String(formData.description ?? ""));

      data.append("sizeLabel", String(formData.size_label ?? ""));
      data.append("sizeLengthMm", String(formData.size_length_mm ?? ""));
      data.append("sizeWidthMm", String(formData.size_width_mm ?? ""));
      data.append("sizeThicknessMm", formData.size_thickness_mm != null ? String(formData.size_thickness_mm) : "");

      data.append("piecesPerBox", String(formData.pieces_per_box ?? ""));
      data.append("sqftPerBox", String(formData.sqft_per_box ?? ""));
      data.append("sqmtPerBox", formData.sqmt_per_box != null ? String(formData.sqmt_per_box) : "");
      data.append("weightPerBoxKg", formData.weight_per_box_kg != null ? String(formData.weight_per_box_kg) : "");

      data.append("finish", String(formData.finish ?? ""));
      data.append("material", String(formData.material ?? ""));
      data.append("brand", String(formData.brand ?? ""));
      data.append("hsnCode", String(formData.hsn_code ?? ""));
      data.append("gstRate", String(formData.gst_rate ?? "18"));
      data.append("mrp", formData.mrp != null ? String(formData.mrp) : "");
      data.append("reorderLevelBoxes", String(formData.reorder_level_boxes ?? "0"));
      data.append("barcode", String(formData.barcode ?? ""));
      data.append("isActive", formData.is_active === true || formData.is_active === 1 ? "true" : "false");

      if (formData.image instanceof File) {
        data.append("image", formData.image);
        setPreviewUrl(URL.createObjectURL(formData.image));
      }

      if (editing?.id) {
        return productApi.update(editing.id, data);
      }
      return productApi.create(data);
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
      setEditing(null);
      setPreviewUrl(null);
      toast.success(editing ? "Product updated" : "Product created");
    },

    onError: (e: { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string }) => {
      const msg =
        e?.response?.data?.error?.message ??
        e?.response?.data?.message ??
        (e?.message || "Failed to save product");
      toast.error(msg);
    },
  });

  /* ===============================
     DELETE
  =============================== */

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setDeleting(null);
      toast.success("Product deleted");
    },
  });

  /* ===============================
     TABLE COLUMNS
  =============================== */

  const columns = [
    {
      key: "imageUrl",
      label: "Preview",
      render: (r: any) =>
        r.imageUrl ? (
          <img
            src={`${BACKEND_URL}/${r.imageUrl}`}
            className="h-12 w-12 object-cover rounded border"
          />
        ) : (
          "—"
        ),
    },
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    {
      key: "category",
      label: "Category",
      render: (r: any) => r.category?.name || "—",
    },
    { key: "size_label", label: "Size" },
    { key: "pieces_per_box", label: "Pcs/Box" },
    { key: "sqft_per_box", label: "Sqft/Box" },
    {
      key: "mrp",
      label: "MRP",
      render: (r: any) => (r.mrp ? `₹${Number(r.mrp).toLocaleString()}` : "—"),
    },
    {
      key: "gst_rate",
      label: "GST%",
      render: (r: any) => `${r.gst_rate}%`,
    },
    {
      key: "is_active",
      label: "Status",
      render: (r: any) => (
        <StatusBadge status={r.is_active ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r: any) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
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
            className="text-destructive"
            onClick={() => setDeleting(r)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  /* ===============================
     RETURN
  =============================== */

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage your tile products catalog"
        onAdd={() => {
          setEditing(null);
          setDialogOpen(true);
          setPreviewUrl(null);
        }}
        addLabel="Add Product"
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <DataTableShell
          data={products}
          columns={columns}
          searchKey="name"
          searchPlaceholder="Search products..."
        />
      )}

      <CrudFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
          setPreviewUrl(null);
        }}
        onSubmit={(d) => saveMutation.mutateAsync(d)}
        fields={fields}
        title={editing ? "Edit Product" : "New Product"}
        initialData={editing}
        loading={saveMutation.isPending}
      />

      {dialogOpen && previewUrl && (
        <div className="fixed bottom-6 right-6 bg-white shadow-lg p-4 rounded-lg border">
          <p className="text-sm font-medium mb-2">Tile Preview</p>
          <img src={previewUrl} className="h-32 w-32 object-cover rounded" />
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutateAsync(deleting?.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
