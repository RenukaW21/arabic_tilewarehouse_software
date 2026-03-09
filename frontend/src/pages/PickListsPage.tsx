import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pickListsApi, type PickList } from '@/api/salesApi';
import { usersApi } from '@/api/usersApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';

export default function PickListsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [assignDialog, setAssignDialog] = useState<PickList | null>(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pickingItem, setPickingItem] = useState<{ pickId: string; itemId: string } | null>(null);
  const [deleting, setDeleting] = useState<PickList | null>(null);
  const applySearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const listParams = {
    page,
    limit: 25,
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    sortBy: 'created_at',
    sortOrder: 'DESC' as const,
  };

  const { data: listData, isLoading } = useQuery({
    queryKey: ['pick-lists', listParams],
    queryFn: () => pickListsApi.getAll(listParams),
  });
  const lists: PickList[] = listData?.data ?? [];
  const meta = listData?.meta ?? null;

  const { data: detailData } = useQuery({
    queryKey: ['pick-lists', detailId],
    queryFn: () => pickListsApi.getById(detailId!),
    enabled: !!detailId,
  });
  const detail: PickList | null = detailData?.data ?? null;

  const { data: assignableUsersData } = useQuery({
    queryKey: ['users-assignable'],
    queryFn: () => usersApi.getAll({ role: 'warehouse_manager,sales', is_active: true, limit: 100 }),
  });
  const assignableUsers = assignableUsersData?.data ?? [];

  const assignMutation = useMutation({
    mutationFn: ({ id, assigned_to }: { id: string; assigned_to: string | null }) =>
      pickListsApi.assign(id, assigned_to || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pick-lists'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['pick-lists', detailId] });
      setAssignDialog(null);
      setAssignedTo('');
      toast.success('Assigned');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Assign failed'),
  });

  const updatePickedMutation = useMutation({
    mutationFn: ({ pickId, itemId, picked_boxes }: { pickId: string; itemId: string; picked_boxes: number }) =>
      pickListsApi.updateItemPicked(pickId, itemId, picked_boxes),
    onSuccess: () => {
      if (detailId) qc.invalidateQueries({ queryKey: ['pick-lists', detailId] });
      setPickingItem(null);
      toast.success('Updated');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(e?.response?.data?.error?.message ?? 'Update failed');
      setPickingItem(null);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => pickListsApi.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pick-lists'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['pick-lists', detailId] });
      toast.success('Pick list completed');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Complete failed'),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => pickListsApi.reopen(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pick-lists'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['pick-lists', detailId] });
      toast.success('Pick list reopened — enter picked quantities and complete again');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Reopen failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pickListsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pick-lists'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['pick-lists', detailId] });
      setDeleting(null);
      toast.success('Pick list deleted');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Delete failed'),
  });

  const columns = [
    { key: 'pick_number', label: 'Pick #', render: (r: PickList) => <span className="font-mono text-sm font-medium">{r.pick_number}</span> },
    { key: 'so_number', label: 'SO #', render: (r: PickList) => r.so_number ?? '—' },
    { key: 'warehouse_name', label: 'Warehouse', render: (r: PickList) => r.warehouse_name ?? '—' },
    { key: 'status', label: 'Status', render: (r: PickList) => <StatusBadge status={r.status} /> },
    { key: 'assigned_to', label: 'Assigned', render: (r: PickList) => r.assigned_to ?? '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: PickList) => (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setDetailId(r.id)}>
            View
          </Button>
          {['pending', 'in_progress'].includes(r.status) && (
            <Button variant="outline" size="sm" onClick={() => { setAssignDialog(r); setAssignedTo(r.assigned_to ?? ''); }} title="Edit / Assign">
              <UserPlus className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          {r.status === 'pending' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)} title="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Pick Lists" subtitle="Manage pick lists from confirmed orders" />
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <DataTableShell<PickList>
        data={lists}
        columns={columns}
        searchPlaceholder="Search pick # or SO #..."
        serverSide
        searchValue={searchInput}
        onSearchChange={(v) => { setSearchInput(v); applySearch(v); }}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {detail && (
        <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{detail.pick_number} — {detail.so_number}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Warehouse: {detail.warehouse_name} · Status: {detail.status} · Assigned: {detail.assigned_to ?? '—'}
            </p>
            {detail.status === 'completed' && !(detail.items ?? []).some((item) => Number(item.picked_boxes) > 0) && (
              <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                <p className="text-amber-800 dark:text-amber-200 mb-2">
                  This pick list was completed with no items picked, so it cannot be used for a delivery challan.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reopenMutation.mutate(detail.id)}
                  disabled={reopenMutation.isPending}
                >
                  {reopenMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Reopen to enter picked quantities
                </Button>
              </div>
            )}
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Requested</th>
                    <th className="px-4 py-2 text-right font-medium">Picked</th>
                    {['pending', 'in_progress'].includes(detail.status) && <th className="w-28" />}
                  </tr>
                </thead>
                <tbody>
                  {(detail.items ?? []).map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-4 py-2">{item.product_code} — {item.product_name}</td>
                      <td className="px-4 py-2 text-right">{Number(item.requested_boxes)}</td>
                      <td className="px-4 py-2 text-right">
                        {['pending', 'in_progress'].includes(detail.status) ? (
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="h-8 w-24 text-right"
                            defaultValue={item.picked_boxes}
                            disabled={pickingItem?.itemId === item.id}
                            onBlur={(e) => {
                              const v = Number(e.target.value) || 0;
                              if (v === item.picked_boxes) return;
                              setPickingItem({ pickId: detail.id, itemId: item.id });
                              updatePickedMutation.mutate({ pickId: detail.id, itemId: item.id, picked_boxes: v });
                            }}
                          />
                        ) : (
                          item.picked_boxes
                        )}
                      </td>
                      {['pending', 'in_progress'].includes(detail.status) && <td />}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {['pending', 'in_progress'].includes(detail.status) && (
              <DialogFooter className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                {!(detail.items ?? []).some((item) => Number(item.picked_boxes) > 0) && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Enter picked quantities for at least one item, then blur the field to save, before completing.
                  </p>
                )}
                <Button
                  onClick={() => completeMutation.mutate(detail.id)}
                  disabled={completeMutation.isPending || !(detail.items ?? []).some((item) => Number(item.picked_boxes) > 0)}
                >
                  {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Mark complete
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!assignDialog} onOpenChange={(open) => !open && setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign pick list</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Assigned to</Label>
            <Select value={assignedTo || 'none'} onValueChange={(v) => setAssignedTo(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Select user (warehouse / sales)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {assignableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name} ({u.email}) — {u.role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>Cancel</Button>
            <Button
              onClick={() => assignDialog && assignMutation.mutate({ id: assignDialog.id, assigned_to: assignedTo.trim() || null })}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Saving...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id)}
        loading={deleteMutation.isPending}
        title="Delete pick list"
        description="Only pending pick lists can be deleted. Are you sure?"
      />
    </div>
  );
}
