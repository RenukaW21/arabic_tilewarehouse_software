import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { grnApi } from '@/api/grnApi';
import type { GRN, GRNItem, UpdateQualityDto } from '@/types/grn.types';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const qualityOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
];

export default function GRNDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: grnRes, isLoading, error } = useQuery({
    queryKey: ['grn', id],
    queryFn: () => grnApi.getById(id!),
    enabled: !!id,
  });

  const postMutation = useMutation({
    mutationFn: () => grnApi.postGRN(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn', id] });
      qc.invalidateQueries({ queryKey: ['grns'] });
      toast.success('GRN posted — stock updated');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Post failed'),
  });

  const updateQualityMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: UpdateQualityDto }) =>
      grnApi.updateQuality(id!, itemId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn', id] });
      toast.success('Quality updated');
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Update failed'),
  });

  const grn: GRN | undefined = grnRes?.data;

  if (!id) {
    return (
      <div>
        <PageHeader title="GRN" subtitle="Invalid GRN" />
        <p className="text-muted-foreground">Missing GRN ID.</p>
      </div>
    );
  }

  if (error || (grnRes && !grnRes.success)) {
    return (
      <div>
        <PageHeader title="GRN" subtitle="Error" />
        <p className="text-destructive">GRN not found or failed to load.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/purchase/grn')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to GRN list
        </Button>
      </div>
    );
  }

  if (isLoading || !grn) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canPost = (grn.status === 'draft' || grn.status === 'verified') && (grn.items?.length ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title={grn.grn_number}
        subtitle={`Vendor: ${grn.vendor_name ?? '—'} · Warehouse: ${grn.warehouse_name ?? '—'}`}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/purchase/grn')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to list
        </Button>
        {canPost && (
          <Button
            size="sm"
            onClick={() => postMutation.mutate()}
            disabled={postMutation.isPending}
          >
            {postMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Post GRN (update stock)
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Status</p>
            <StatusBadge status={grn.status} />
          </div>
          <div>
            <p className="text-muted-foreground">Receipt date</p>
            <p>{(grn.receipt_date ?? grn.received_date) ? new Date(grn.receipt_date ?? grn.received_date!).toLocaleDateString() : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Invoice #</p>
            <p>{grn.invoice_number ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Grand total</p>
            <p>₹{Number(grn.grand_total ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b bg-muted/50 font-medium">GRN Items</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium">Product</th>
                <th className="px-4 py-2 text-right font-medium">Received (boxes)</th>
                <th className="px-4 py-2 text-right font-medium">Unit cost</th>
                <th className="px-4 py-2 text-left font-medium">Quality</th>
                <th className="w-40" />
              </tr>
            </thead>
            <tbody>
              {(grn.items ?? []).map((item: GRNItem) => (
                <tr key={item.id} className="border-b">
                  <td className="px-4 py-2">
                    {item.product_code} – {item.product_name}
                  </td>
                  <td className="px-4 py-2 text-right">{Number((item as any).received_boxes ?? item.received_qty_boxes ?? 0)}</td>
                  <td className="px-4 py-2 text-right">₹{Number((item as any).unit_price ?? item.unit_cost ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    {(grn.status === 'draft' || grn.status === 'verified') && item.id ? (
                      <Select
                        value={(item.quality_status as string) ?? 'pending'}
                        onValueChange={(v) =>
                          updateQualityMutation.mutate({
                            itemId: item.id!,
                            data: { qualityStatus: v, qualityNotes: null },
                          })
                        }
                      >
                        <SelectTrigger className="h-9 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {qualityOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="capitalize">{(item.quality_status as string) ?? 'pending'}</span>
                    )}
                  </td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!grn.items || grn.items.length === 0) && (
          <p className="px-4 py-6 text-center text-muted-foreground">No items</p>
        )}
      </div>
    </div>
  );
}
