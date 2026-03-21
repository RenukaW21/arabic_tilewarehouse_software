import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/api/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function CategoriesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const categories = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((c: any) => ({
      id: c.id,
      name: c.name,
      parentId: c.parent_id ?? c.parentId ?? null,
      isActive: !!(c.is_active ?? c.isActive),
    }));
  }, [data]);

  const fields: FieldDef[] = useMemo(() => [
    {
      key: "name",
      label: t('categories.categoryName'),
      type: "text",
      required: true,
      placeholder: "Floor Tiles",
    },
    {
      key: "parentId",
      label: t('common.none'),
      type: "select",
      options: [
        { value: "__none__", label: t('common.none') },
        ...categories
          .filter((c) => c.id !== editing?.id)
          .map((c) => ({
            value: c.id,
            label: c.name,
          })),
      ],
    },
    {
      key: "isActive",
      label: t('common.status'),
      type: "switch",
      defaultValue: true,
    },
  ], [categories, editing, t]);

  const saveMutation = useMutation({
    mutationFn: async (formData: any) => {
      const payload = {
        name: formData.name,
        parentId:
          formData.parentId === "__none__"
            ? null
            : formData.parentId || null,
        isActive: formData.isActive ?? true,
      };
      return editing
        ? updateCategory(editing.id, payload)
        : createCategory(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? t('categories.categoryUpdated') : t('categories.categoryCreated'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setDeleting(null);
      toast.success(t('categories.categoryDeleted'));
    },
  });

  const columns = [
    { key: "name", label: t('categories.categoryName') },
    {
      key: "parentId",
      label: "Parent",
      render: (row: any) =>
        categories.find((c) => c.id === row.parentId)?.name || "—",
    },
    {
      key: "isActive",
      label: t('common.status'),
      render: (row: any) => (
        <StatusBadge status={row.isActive ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      label: t('common.actions'),
      render: (row: any) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditing(row);
              setDialogOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => setDeleting(row)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('categories.title')}
        subtitle={t('categories.subtitle')}
        onAdd={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
        addLabel={t('categories.addCategory')}
      />

      {isLoading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <DataTableShell
          data={categories}
          columns={columns}
          searchKey="name"
        />
      )}

      <CrudFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSubmit={(data) => saveMutation.mutateAsync(data)}
        fields={fields}
        title={editing ? t('categories.editCategory') : t('categories.newCategory')}
        initialData={editing}
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