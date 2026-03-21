import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productApi } from "@/api/productApi";
import { getCategories } from "@/api/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { CsvImportDialog } from "@/components/shared/CsvImportDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Eye, FileUp } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const BACKEND_URL = API_BASE.replace(/\/api\/v1\/?$/, '') || 'http://localhost:5000';

export default function ProductsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const listParams = {
    page,
    limit: 10,
    search: search.trim() || undefined,
    sortBy: "created_at" as const,
    sortOrder: "DESC" as const,
  };

  const { data: paged, isLoading } = useQuery({
    queryKey: ["products", listParams],
    queryFn: () => productApi.getAll(listParams),
  });
  const products = (paged as any)?.data ?? [];
  const meta = (paged as any)?.meta ?? null;

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const onSearchChange = (val: string) => {
    setSearchInput(val);
    handleSearch(val);
  };

  useEffect(() => {
    const editImg = editing?.imageUrl || editing?.image_url;
    if (editImg) {
      setPreviewUrl(`${BACKEND_URL}${editImg.startsWith('/') ? '' : '/'}${editImg}`);
    } else {
      setPreviewUrl(null);
    }
  }, [editing]);

  const fields: FieldDef[] = [
    {
      key: "category_id",
      label: t('products.category'),
      type: "select",
      required: true,
      options: categories.map((c: any) => ({ label: c.name, value: c.id })),
    },
    { key: "name", label: t('products.productName'), type: "text", required: true },
    { key: "code", label: t('products.productCode'), type: "text", required: true },
    { key: "size_label", label: t('products.sizeLabel'), type: "text", required: true },
    { key: "size_length_mm", label: t('products.lengthMm'), type: "number", required: true },
    { key: "size_width_mm", label: t('products.widthMm'), type: "number", required: true },
    { key: "pieces_per_box", label: t('products.piecesPerBox'), type: "number", required: true },
    { key: "sqft_per_box", label: t('products.sqftPerBox'), type: "number", required: true },
    { key: "brand", label: t('products.brand'), type: "text" },
    { key: "gst_rate", label: t('products.gstRate'), type: "number", defaultValue: 18 },
    { key: "mrp", label: t('products.mrp'), type: "number" },
    { key: "reorder_level_boxes", label: t('products.reorderLevel'), type: "number", defaultValue: 0 },
    { key: "description", label: t('common.description'), type: "textarea" },
    { key: "is_active", label: t('products.status'), type: "switch", defaultValue: true },
    { key: "image", label: t('products.tileImage'), type: "file" }
  ];

  const saveMutation = useMutation({
    mutationFn: async (formData: Record<string, unknown>) => {
      const data = new FormData();

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

      const skipKeys = new Set([
        'id', 'tenant_id', 'created_at', 'updated_at',
        'image_url', 'imageUrl',
        'category_name', 'rack_names', 'rack_id',
        'total_boxes_stored', 'warehouse_names',
        'vendors', 'customers',
      ]);

      Object.entries(formData).forEach(([key, value]) => {
        if (skipKeys.has(key)) return;
        if (key === 'image') {
          if (value instanceof File) data.append('image', value);
          return;
        }
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
      toast.success(editing ? t('products.productUpdated') : t('products.productCreated'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setDeleting(null);
      toast.success(t('products.productDeleted'));
    },
  });

  const columns = [
    {
      key: "imageUrl",
      label: t('common.preview'),
      render: (r: any) => {
        const img = r.imageUrl || r.image_url;
        return img ? (
          <img src={`${BACKEND_URL}${img.startsWith('/') ? '' : '/'}${img}`} className="h-10 w-10 object-cover rounded border" />
        ) : "—";
      },
    },
    { key: "code", label: t('common.code') },
    { key: "name", label: t('common.name') },
    {
      key: "storage",
      label: t('common.storage'),
      render: (r: any) => (
        <div className="text-xs">
          {r.total_boxes_stored > 0 ? (
            <div className="text-muted-foreground">{r.total_boxes_stored} {t('common.boxesStored')}</div>
          ) : (
            <div className="text-muted-foreground">{t('common.unassigned')}</div>
          )}
        </div>
      ),
    },
    { key: "size_label", label: t('common.size') },
    {
      key: "is_active",
      label: t('common.status'),
      render: (r: any) => <StatusBadge status={r.is_active ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      label: t('common.actions'),
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
        title={t('products.title')}
        subtitle={t('products.subtitle')}
        onAdd={() => { setEditing(null); setDialogOpen(true); setPreviewUrl(null); }}
        addLabel={t('products.addProduct')}
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

      <DataTableShell
        data={products}
        columns={columns}
        searchKey="name"
        isLoading={isLoading}
        serverSide
        searchValue={searchInput}
        onSearchChange={onSearchChange}
        paginationMeta={meta}
        onPageChange={setPage}
      />

      <CrudFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSubmit={(d) => saveMutation.mutateAsync(d) as any}
        fields={fields}
        title={editing ? t('products.editProduct') : t('products.newProduct')}
        initialData={editing ? { ...editing } : null}
        loading={saveMutation.isPending}
      />

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutateAsync(deleting?.id) as any}
        loading={deleteMutation.isPending}
      />

      <CsvImportDialog
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
      />
    </div>
  );
}
