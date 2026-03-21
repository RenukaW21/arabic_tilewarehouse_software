import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  usersApi,
  type User,
  type CreateUserDto,
  type UpdateUserDto,
  ROLES,
} from "@/api/usersApi";
import { warehouseApi } from "@/api/warehouseApi";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  warehouse_manager: "Warehouse Manager",
  sales: "Sales",
  accountant: "Accountant",
  user: "User",
};

interface WarehouseOption {
  value: string;
  label: string;
}

export default function UsersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");

  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    role: roleFilter || undefined,
    is_active: activeFilter === "" ? undefined : activeFilter === "true",
    sortBy: "name",
    sortOrder: "ASC" as const,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["users", listParams],
    queryFn: () => usersApi.getAll(listParams),
  });

  const users: User[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const { data: warehousesData } = useQuery({
    queryKey: ["warehouses", { limit: 500 }],
    queryFn: () => warehouseApi.getAll({ limit: 500 }),
  });

  const warehouseOptions: WarehouseOption[] =
    warehousesData?.data?.map((w) => ({
      value: w.id,
      label: `${w.code} - ${w.name}`,
    })) ?? [];

  const getWarehouseLabel = (warehouseId: string | null | undefined) => {
    if (!warehouseId) return "—";
    return warehouseOptions.find((w) => w.value === warehouseId)?.label ?? "—";
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserDto) => usersApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setCreateOpen(false);
      toast.success(t('users.userCreated'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? "Create failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserDto }) =>
      usersApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setEditing(null);
      toast.success(t('users.userUpdated'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? "Update failed"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setDeactivateTarget(null);
      toast.success(t('users.userDeleted'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? "Deactivate failed"),
  });

  const columns = [
    { key: "name", label: t('common.name'), render: (r: User) => r.name },
    { key: "email", label: t('users.email'), render: (r: User) => r.email },
    {
      key: "role",
      label: t('users.role'),
      render: (r: User) => roleLabels[r.role] ?? r.role,
    },
    {
      key: "warehouse",
      label: t('warehouses.title'),
      render: (r: User) => (
        <span className="text-sm">
          {getWarehouseLabel((r as User & { warehouse_id?: string }).warehouse_id)}
        </span>
      ),
    },
    { key: "phone", label: t('customers.phone'), render: (r: User) => r.phone ?? "—" },
    {
      key: "is_active",
      label: t('common.status'),
      render: (r: User) => (
        <StatusBadge
          status={
            r.is_active === true || r.is_active === 1 ? "active" : "inactive"
          }
        />
      ),
    },
    {
      key: "actions",
      label: t('common.actions'),
      render: (r: User) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setEditing(r)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {(r.is_active === true || r.is_active === 1) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => setDeactivateTarget(r)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        onAdd={() => setCreateOpen(true)}
        addLabel={t('users.addUser')}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{t('common.allRoles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{t('common.allStatuses')}</option>
          <option value="true">{t('common.active')}</option>
          <option value="false">{t('common.inactive')}</option>
        </select>
      </div>

      {isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {(error as Error)?.message ?? "Failed to load users"}
        </div>
      )}

      <DataTableShell<User>
        data={users}
        columns={columns}
        searchPlaceholder="Search by name or email..."
        serverSide
        searchValue={searchInput}
        onSearchChange={(v) => {
          setSearchInput(v);
          applySearch(v);
        }}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {users.length === 0 && !isLoading && !isError && (
        <div className="rounded-md border border-dashed px-4 py-8 text-center text-muted-foreground">
          {t('users.noUsersFound')}
        </div>
      )}

      {/* Create modal */}
      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
        loading={createMutation.isPending}
        warehouseOptions={warehouseOptions}
      />

      {/* Edit modal */}
      <EditUserDialog
        user={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={(payload) =>
          editing && updateMutation.mutate({ id: editing.id, payload })
        }
        loading={updateMutation.isPending}
        warehouseOptions={warehouseOptions}
      />

      {/* Deactivate confirm */}
      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.deactivateTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('users.deactivateDesc').replace('{{name}}', deactivateTarget?.name ?? '')}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)} disabled={deactivateMutation.isPending}>
              {deactivateMutation.isPending ? t('users.deactivating') : t('users.deactivate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Create Dialog ─────────────────────────────────────────────────────────────

function CreateUserDialog({
  open,
  onClose,
  onSubmit,
  loading,
  warehouseOptions,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateUserDto) => void;
  loading: boolean;
  warehouseOptions: WarehouseOption[];
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<User["role"]>("user");
  const [phone, setPhone] = useState("");
  const [warehouseId, setWarehouseId] = useState<string>("");

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setRole("user");
    setPhone("");
    setWarehouseId("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      email,
      password,
      role,
      phone: phone.trim() || null,
      warehouse_id: warehouseId || null,
    } as CreateUserDto & { warehouse_id: string | null });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> {t('users.addUserTitle')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">{t('common.name')}</Label>
            <Input
              id="create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('users.placeholderFullName')}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-email">{t('common.email')}</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('users.placeholderEmail')}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-password">{t('common.password')}</Label>
            <Input
              id="create-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('users.placeholderPassword')}
              minLength={6}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('common.role')}</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as User["role"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('users.warehouseOptional')}</Label>
            <Select
              value={warehouseId}
              onValueChange={(v) => setWarehouseId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('users.placeholderNoWarehouse')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('common.noWarehouse')}</SelectItem>
                {warehouseOptions.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-phone">{t('users.phoneOptional')}</Label>
            <Input
              id="create-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('common.phone')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('common.saving') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Dialog ───────────────────────────────────────────────────────────────

function EditUserDialog({
  user,
  open,
  onClose,
  onSubmit,
  loading,
  warehouseOptions,
}: {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: UpdateUserDto) => void;
  loading: boolean;
  warehouseOptions: WarehouseOption[];
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<User["role"]>("user");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [warehouseId, setWarehouseId] = useState<string>("");

  useEffect(() => {
    if (user && open) {
      setName(user.name);
      setPassword("");
      setPhone(user.phone ?? "");
      setRole(user.role);
      setIsActive(user.is_active === true || user.is_active === 1);
      setWarehouseId(
        (user as User & { warehouse_id?: string }).warehouse_id ?? ""
      );
    }
  }, [user, open]);

  const reset = () => {
    setName("");
    setPassword("");
    setPhone("");
    setRole("user");
    setIsActive(true);
    setWarehouseId("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      reset();
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UpdateUserDto & { warehouse_id?: string | null } = {
      name,
      role,
      phone: phone.trim() || null,
      is_active: isActive,
      warehouse_id: warehouseId || null,
    };
    if (password.trim()) payload.password = password.trim();
    onSubmit(payload);
    handleOpenChange(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.editUserTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">{t('common.name')}</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('users.placeholderFullName')}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">Email: {user.email}</p>
          <div className="space-y-2">
            <Label htmlFor="edit-password">{t('users.newPassword')}</Label>
            <Input
              id="edit-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('users.placeholderPassword')}
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('common.role')}</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as User["role"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('warehouses.title')}</Label>
            <Select
              value={warehouseId || "__none__"}
              onValueChange={(v) => setWarehouseId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('users.placeholderNoWarehouse')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('common.noWarehouse')}</SelectItem>
                {warehouseOptions.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">{t('common.phone')}</Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('common.phone')}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            <Label htmlFor="edit-active" className="font-normal">
              {t('users.isActive')}
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}