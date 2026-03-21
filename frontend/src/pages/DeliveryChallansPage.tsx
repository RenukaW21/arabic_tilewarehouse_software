import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deliveryChallansApi,
  pickListsApi,
  type DeliveryChallan,
  type PickList,
} from '@/api/salesApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Truck, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { useTranslation } from 'react-i18next';

export default function DeliveryChallansPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [pickListId, setPickListId] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DeliveryChallan | null>(null);
  const [editing, setEditing] = useState<DeliveryChallan | null>(null);
  const [editForm, setEditForm] = useState({
    dispatch_date: '',
    vehicle_number: '',
    transporter_name: '',
    lr_number: '',
  });
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
    queryKey: ['delivery-challans', listParams],
    queryFn: () => deliveryChallansApi.getAll(listParams),
  });
  const challans: DeliveryChallan[] = listData?.data ?? [];
  const meta = listData?.meta ?? null;

  const { data: completedPicks } = useQuery({
    queryKey: ['pick-lists-completed'],
    queryFn: () => pickListsApi.getAll({ status: 'completed', limit: 100 }),
  });
  const pickOptions: PickList[] = completedPicks?.data ?? [];

  const { data: detailData } = useQuery({
    queryKey: ['delivery-challans', detailId],
    queryFn: () => deliveryChallansApi.getById(detailId!),
    enabled: !!detailId,
  });
  const detail: DeliveryChallan | null = detailData?.data ?? null;

  const createMutation = useMutation({
    mutationFn: () =>
      deliveryChallansApi.createFromPickList({
        pick_list_id: pickListId,
        dispatch_date: dispatchDate,
        vehicle_number: vehicleNumber || undefined,
        transporter_name: transporterName || undefined,
        lr_number: lrNumber || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-challans'] });
      setCreateOpen(false);
      setPickListId('');
      setVehicleNumber('');
      setTransporterName('');
      setLrNumber('');
      toast.success(t('deliveryChallans.created'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? t('deliveryChallans.createFailed')),
  });

  const dispatchMutation = useMutation({
    mutationFn: (id: string) => deliveryChallansApi.dispatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-challans'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['delivery-challans', detailId] });
      toast.success(t('deliveryChallans.dispatchedSuccess'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? t('deliveryChallans.dispatchFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deliveryChallansApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-challans'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['delivery-challans', detailId] });
      setDeleting(null);
      toast.success(t('deliveryChallans.deleted'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? t('deliveryChallans.deleteFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      deliveryChallansApi.update(id, {
        dispatch_date: editForm.dispatch_date || undefined,
        vehicle_number: editForm.vehicle_number || undefined,
        transporter_name: editForm.transporter_name || undefined,
        lr_number: editForm.lr_number || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-challans'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['delivery-challans', detailId] });
      setEditing(null);
      toast.success(t('deliveryChallans.updated'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? t('deliveryChallans.updateFailed')),
  });

  const openEdit = (c: DeliveryChallan) => {
    setEditing(c);
    setEditForm({
      dispatch_date: c.dispatch_date ? new Date(c.dispatch_date).toISOString().slice(0, 10) : '',
      vehicle_number: c.vehicle_number ?? '',
      transporter_name: c.transporter_name ?? '',
      lr_number: c.lr_number ?? '',
    });
  };

  const columns = [
    { key: 'dc_number', label: t('deliveryChallans.dcHash'), render: (r: DeliveryChallan) => <span className="font-mono text-sm font-medium">{r.dc_number}</span> },
    { key: 'so_number', label: t('deliveryChallans.soHash'), render: (r: DeliveryChallan) => r.so_number ?? '—' },
    { key: 'customer_name', label: t('deliveryChallans.customer'), render: (r: DeliveryChallan) => r.customer_name ?? '—' },
    { key: 'status', label: t('deliveryChallans.status'), render: (r: DeliveryChallan) => <StatusBadge status={r.status} /> },
    { key: 'dispatch_date', label: t('deliveryChallans.date'), render: (r: DeliveryChallan) => (r.dispatch_date ? new Date(r.dispatch_date).toLocaleDateString() : '—') },
    { key: 'vehicle_number', label: t('deliveryChallans.vehicle'), render: (r: DeliveryChallan) => r.vehicle_number ?? '—' },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (r: DeliveryChallan) => (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setDetailId(r.id)}>{t('common.view')}</Button>
          {r.status === 'draft' && (
            <>
              <Button variant="outline" size="sm" onClick={() => openEdit(r)} title={t('common.edit')}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => dispatchMutation.mutate(r.id)}
                disabled={dispatchMutation.isPending}
              >
                <Truck className="h-4 w-4 mr-1" /> {t('deliveryChallans.dispatch')}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(r)} title={t('common.delete')}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('deliveryChallans.title')}
        subtitle={t('deliveryChallans.subtitle')}
        onAdd={() => setCreateOpen(true)}
        addLabel={t('deliveryChallans.newChallan')}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{t('deliveryChallans.allStatuses')}</option>
          <option value="draft">{t('deliveryChallans.statusDraft')}</option>
          <option value="dispatched">{t('deliveryChallans.statusDispatched')}</option>
          <option value="delivered">{t('deliveryChallans.statusDelivered')}</option>
          <option value="returned">{t('deliveryChallans.statusReturned')}</option>
        </select>
      </div>
      <DataTableShell<DeliveryChallan>
        data={challans}
        columns={columns}
        searchPlaceholder={t('deliveryChallans.searchPlaceholder')}
        serverSide
        searchValue={searchInput}
        onSearchChange={(v) => { setSearchInput(v); applySearch(v); }}
        paginationMeta={meta ?? undefined}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deliveryChallans.createFromPickList')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('deliveryChallans.completedPickList')}</Label>
              <Select value={pickListId} onValueChange={setPickListId}>
                <SelectTrigger><SelectValue placeholder={t('deliveryChallans.selectPickList')} /></SelectTrigger>
                <SelectContent>
                  {pickOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.pick_number} — {p.so_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('deliveryChallans.dispatchDate')}</Label>
              <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('deliveryChallans.vehicleNumberOptional')}</Label>
              <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder={t('deliveryChallans.vehiclePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('deliveryChallans.transporterOptional')}</Label>
              <Input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} placeholder={t('deliveryChallans.transporterPlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('deliveryChallans.lrNumberOptional')}</Label>
              <Input value={lrNumber} onChange={(e) => setLrNumber(e.target.value)} placeholder={t('deliveryChallans.lrPlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!pickListId || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('deliveryChallans.newChallan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detail && (
        <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{detail.dc_number} — {detail.so_number}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t('deliveryChallans.customer')}: {detail.customer_name} · {t('deliveryChallans.status')}: {detail.status} · {t('deliveryChallans.date')}: {detail.dispatch_date ? new Date(detail.dispatch_date).toLocaleDateString() : '—'}
              {detail.vehicle_number ? ` · ${t('deliveryChallans.vehicle')}: ${detail.vehicle_number}` : ''}
              {detail.transporter_name ? ` · ${t('deliveryChallans.transporterOptional')}: ${detail.transporter_name}` : ''}
              {detail.lr_number ? ` · ${t('deliveryChallans.lrNumber')}: ${detail.lr_number}` : ''}
            </p>
            {detail.status === 'draft' && (
              <Button variant="outline" size="sm" className="w-fit" onClick={() => { openEdit(detail); setDetailId(null); }}>
                <Pencil className="h-4 w-4 mr-1" /> {t('deliveryChallans.editChallan')}
              </Button>
            )}
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium">{t('deliveryChallans.product')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('deliveryChallans.boxes')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('deliveryChallans.unitPrice')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items ?? []).map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-4 py-2">{item.product_code} — {item.product_name}</td>
                      <td className="px-4 py-2 text-right">{Number(item.dispatched_boxes)}</td>
                      <td className="px-4 py-2 text-right">₹{Number(item.unit_price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <DeleteConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id)}
        loading={deleteMutation.isPending}
        title={t('deliveryChallans.deleteTitle')}
        description={t('deliveryChallans.deleteDesc')}
      />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deliveryChallans.editChallan')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('deliveryChallans.dispatchDate')}</Label>
              <Input
                type="date"
                value={editForm.dispatch_date}
                onChange={(e) => setEditForm((f) => ({ ...f, dispatch_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('deliveryChallans.vehicleNumber')}</Label>
              <Input
                value={editForm.vehicle_number}
                onChange={(e) => setEditForm((f) => ({ ...f, vehicle_number: e.target.value }))}
                placeholder={t('deliveryChallans.vehiclePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('deliveryChallans.transporterName')}</Label>
              <Input
                value={editForm.transporter_name}
                onChange={(e) => setEditForm((f) => ({ ...f, transporter_name: e.target.value }))}
                placeholder={t('deliveryChallans.transporterPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('deliveryChallans.lrNumber')}</Label>
              <Input
                value={editForm.lr_number}
                onChange={(e) => setEditForm((f) => ({ ...f, lr_number: e.target.value }))}
                placeholder={t('deliveryChallans.lrPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => editing && updateMutation.mutate(editing.id)}
              disabled={!editing || updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
