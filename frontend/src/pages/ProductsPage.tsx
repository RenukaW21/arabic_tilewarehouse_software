import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productApi } from "@/api/productApi";
import { getCategories } from "@/api/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const BACKEND_URL = API_BASE.replace(/\/api\/v1\/?$/, '') || 'http://localhost:5000';

export default function ProductsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* ===============================
     DATA FETCHING
  =============================== */

  const { data: paged, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => productApi.getAll({ page: 1, limit: 100 }),
  });
  const products = (paged as any)?.data ?? [];

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  /* ===============================
     HANDLE PREVIEW
  =============================== */
  useEffect(() => {
    const editImg = editing?.imageUrl || editing?.image_url;
    if (editImg) {
      setPreviewUrl(`${BACKEND_URL}${editImg.startsWith('/') ? '' : '/'}${editImg}`);
    } else {
      setPreviewUrl(null);
    }
  }, [editing]);

  /* ===============================
     FIELDS
  =============================== */
  const fields: FieldDef[] = [
    {
      key: "category_id",
      label: "Category",
      type: "select",
      required: true,
      options: categories.map((c: any) => ({ label: c.name, value: c.id })),
    },
    { key: "name", label: "Product Name", type: "text", required: true },
    { key: "code", label: "Product Code", type: "text", required: true },
    { key: "size_label", label: "Size Label", type: "text", required: true },
    { key: "size_length_mm", label: "Length (mm)", type: "number", required: true },
    { key: "size_width_mm", label: "Width (mm)", type: "number", required: true },
    { key: "pieces_per_box", label: "Pieces/Box", type: "number", required: true },
    { key: "sqft_per_box", label: "Sqft/Box", type: "number", required: true },
    { key: "brand", label: "Brand", type: "text" },
    { key: "gst_rate", label: "GST Rate (%)", type: "number", defaultValue: 18 },
    { key: "mrp", label: "MRP (₹)", type: "number" },
    { key: "reorder_level_boxes", label: "Reorder Level", type: "number", defaultValue: 0 },

    { key: "description", label: "Description", type: "textarea" },
    { key: "is_active", label: "Status", type: "switch", defaultValue: true },
    { key: "image", label: "Tile Image", type: "file" }
  ];

  /* ===============================
     SAVE MUTATION
  =============================== */
  const saveMutation = useMutation({
    mutationFn: async (formData: Record<string, unknown>) => {
      const data = new FormData();

      // Map frontend snake_case keys to backend camelCase DTO keys
      const keyMap: Record<string, string> = {
        category_id: "categoryId",
        size_label: "sizeLabel",
        size_length_mm: "sizeLengthMm",
        size_width_mm: "sizeWidthMm",
        pieces_per_box: "piecesPerBox",
        sqft_per_box: "sqftPerBox",
        gst_rate: "gstRate",
        reorder_level_boxes: "reorderLevelBoxes",
        is_active: "isActive",
      };

      // Keys that are internal/DB fields from the product row — never send these to backend
      const skipKeys = new Set([
        'id', 'tenant_id', 'created_at', 'updated_at',
        'image_url', 'imageUrl',   // old url — backend keeps it if no new file
        'category_name', 'rack_names', 'rack_id',
        'total_boxes_stored', 'warehouse_names',
        'vendors', 'customers',
      ]);

      Object.entries(formData).forEach(([key, value]) => {
        // Skip internal/DB-only keys
        if (skipKeys.has(key)) return;

        // Image: only append if it's an actual File selected by the user
        if (key === 'image') {
          if (value instanceof File) data.append('image', value);
          return; // skip if it's a string path or null
        }

        // Skip truly empty values (undefined, null), but ALLOW empty strings ''
        // so that optional fields can be explicitly cleared by the user.
        if (value === undefined || value === null) return;

        const backendKey = keyMap[key] ?? key;
        data.append(backendKey, String(value));
      });

      if (editing?.id) return productApi.update(editing.id, data);
      return productApi.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? "Product updated" : "Product created");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setDeleting(null);
      toast.success("Product deleted");
    },
  });

  const columns = [
    {
      key: "imageUrl",
      label: "Preview",
      render: (r: any) => {
        const img = r.imageUrl || r.image_url;
        return img ? (
          <img src={`${BACKEND_URL}${img.startsWith('/') ? '' : '/'}${img}`} className="h-10 w-10 object-cover rounded border" />
        ) : "—";
      },
    },
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    {
      key: "storage",
      label: "Storage",
      render: (r: any) => (
        <div className="text-xs">
          {r.total_boxes_stored > 0 ? (
            <div className="text-muted-foreground">{r.total_boxes_stored} boxes stored</div>
          ) : (
            <div className="text-muted-foreground">Unassigned</div>
          )}
        </div>
      ),
    },
    { key: "size_label", label: "Size" },
    {
      key: "is_active",
      label: "Status",
      render: (r: any) => <StatusBadge status={r.is_active ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (r: any) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/master/products/${r.id}`)}><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage tile Products"
        onAdd={() => { setEditing(null); setDialogOpen(true); setPreviewUrl(null); }}
        addLabel="Add Product"
      />

      <DataTableShell data={products} columns={columns} searchKey="name" isLoading={isLoading} />

      <CrudFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSubmit={(d) => saveMutation.mutateAsync(d)}
        fields={fields}
        title={editing ? "Edit Product" : "New Product"}
        initialData={editing ? { ...editing } : null}
        loading={saveMutation.isPending}
      />

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutateAsync(deleting?.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
