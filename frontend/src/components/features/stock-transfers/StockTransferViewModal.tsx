'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockTransferApi } from '@/api/stockTransferApi';
import type { StockTransfer } from '@/types/stock.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAuth } from '@/hooks/useAuth';
import { generateTransferChallanPDF } from '@/utils/pdfGenerator';
import {
  Loader2,
  Printer,
  PackageCheck,
  ArrowRight,
  Check,
  Clock,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  transferId: string | null;
  open: boolean;
  onClose: () => void;
  getWarehouseName: (id: string) => string;
}

// ─── Timeline step ────────────────────────────────────────────────────────────

function TimelineStep({
  done,
  active,
  last,
  label,
  timestamp,
}: {
  done: boolean;
  active?: boolean;
  last?: boolean;
  label: string;
  timestamp?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 ${
            done
              ? 'bg-green-500 border-green-500 text-white'
              : active
              ? 'border-blue-500 bg-blue-500 text-white'
              : 'bg-background border-muted-foreground/30'
          }`}
        >
          {done ? (
            <Check className="h-3.5 w-3.5" />
          ) : active ? (
            <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
          ) : null}
        </div>
        {!last && (
          <div
            className={`w-0.5 h-8 mt-0.5 ${done ? 'bg-green-400' : 'bg-muted-foreground/20'}`}
          />
        )}
      </div>
      <div className="pb-4">
        <p
          className={`text-sm font-medium leading-7 ${
            !done && !active ? 'text-muted-foreground' : ''
          }`}
        >
          {label}
        </p>
        {timestamp && (
          <p className="text-xs text-muted-foreground -mt-1">{timestamp}</p>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// ─── Main component ───────────────────────────────────────────────────────────

export function StockTransferViewModal({
  transferId,
  open,
  onClose,
  getWarehouseName,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [remarks, setRemarks] = useState('');

  const { data: transfer, isLoading } = useQuery<StockTransfer>({
    queryKey: ['stock-transfer-detail', transferId],
    queryFn: () => stockTransferApi.getById(transferId!),
    enabled: !!transferId && open,
  });

  const receiveMutation = useMutation({
    mutationFn: () =>
      stockTransferApi.receive(transfer!.id, remarks.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      qc.invalidateQueries({ queryKey: ['stock-transfer-detail', transferId] });
      toast.success('Transfer received — stock added to destination warehouse');
      setRemarks('');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to receive transfer');
    },
  });

  const canReceive =
    user?.role === 'warehouse_manager' ||
    user?.role === 'admin' ||
    user?.role === 'super_admin';

  const handlePrint = () => {
    if (!transfer) return;
    generateTransferChallanPDF({
      transfer,
      fromWarehouseName: getWarehouseName(transfer.from_warehouse_id),
      toWarehouseName: getWarehouseName(transfer.to_warehouse_id),
    });
  };

  const handleClose = () => {
    setRemarks('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        {isLoading || !transfer ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── HEADER ─────────────────────────────────────────────────────── */}
            <div className="bg-muted/40 border-b px-6 py-5">
              <DialogHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <DialogTitle className="text-xl font-semibold font-mono tracking-tight">
                      {transfer.transfer_number}
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusBadge status={transfer.status} />
                      <span className="text-sm text-muted-foreground">
                        {fmtDate(transfer.transfer_date)}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground text-right space-y-0.5">
                    <div>Created {fmtDateTime(transfer.created_at)}</div>
                    {transfer.vehicle_number && (
                      <div>Vehicle: <span className="font-medium text-foreground">{transfer.vehicle_number}</span></div>
                    )}
                  </div>
                </div>

                {/* From → To */}
                <div className="flex items-stretch gap-3 mt-4 pt-4 border-t">
                  <div className="flex-1 rounded-md bg-background border px-4 py-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                      From
                    </p>
                    <p className="font-semibold text-sm mt-0.5">
                      {getWarehouseName(transfer.from_warehouse_id)}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 rounded-md bg-background border px-4 py-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                      To
                    </p>
                    <p className="font-semibold text-sm mt-0.5">
                      {getWarehouseName(transfer.to_warehouse_id)}
                    </p>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* ── ITEMS TABLE ────────────────────────────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold mb-2.5 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Transfer Items
                </h3>
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-2.5 text-left font-medium">Product</th>
                        <th className="px-4 py-2.5 text-left font-medium">SKU / Code</th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          Ordered (Boxes)
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          Received (Boxes)
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium">Discrepancy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(transfer.items ?? []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            No items
                          </td>
                        </tr>
                      ) : (
                        (transfer.items ?? []).map((item, idx) => {
                          const received = Number(item.received_boxes ?? 0);
                          const ordered = Number(item.transferred_boxes);
                          const discrepancy =
                            transfer.status === 'received'
                              ? received - ordered
                              : null;

                          return (
                            <tr
                              key={item.id ?? idx}
                              className="border-b last:border-0 hover:bg-muted/20"
                            >
                              <td className="px-4 py-3 font-medium">
                                {item.product_name ?? item.product_id}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                {item.product_code ?? '—'}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {ordered}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {transfer.status === 'received' ? (
                                  received
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {discrepancy === null ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : discrepancy === 0 ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <span
                                    className={
                                      discrepancy < 0
                                        ? 'text-destructive font-medium'
                                        : 'text-green-600 font-medium'
                                    }
                                  >
                                    {discrepancy > 0
                                      ? `+${discrepancy}`
                                      : discrepancy}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ── TIMELINE ───────────────────────────────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Timeline
                </h3>
                <div>
                  <TimelineStep
                    done
                    label="Draft Created"
                    timestamp={fmtDateTime(transfer.created_at)}
                  />
                  <TimelineStep
                    done={transfer.status === 'received' || transfer.status === 'in_transit'}
                    active={transfer.status === 'in_transit'}
                    label="Confirmed → In Transit"
                    timestamp={
                      transfer.status !== 'draft'
                        ? fmtDate(transfer.transfer_date)
                        : undefined
                    }
                  />
                  <TimelineStep
                    done={transfer.status === 'received'}
                    label="Received at Destination"
                    timestamp={
                      transfer.status === 'received'
                        ? fmtDate(transfer.received_date)
                        : undefined
                    }
                    last
                  />
                </div>
              </section>

              {/* ── NOTES (read-only) ──────────────────────────────────────────── */}
              {transfer.notes && (
                <div className="rounded-md bg-muted/40 border px-4 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1">
                    Notes
                  </p>
                  <p className="text-sm">{transfer.notes}</p>
                </div>
              )}

              {/* ── REMARKS (editable only when receiving) ─────────────────────── */}
              {transfer.status === 'in_transit' && canReceive && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Remarks on Receive{' '}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    placeholder="e.g. 2 boxes damaged on arrival, vehicle arrived late…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* ── FOOTER ACTIONS ─────────────────────────────────────────────── */}
            <div className="border-t px-6 py-4 flex items-center justify-between gap-3 bg-muted/20 sticky bottom-0">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1.5" />
                Print Challan
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                {transfer.status === 'in_transit' && canReceive && (
                  <Button
                    onClick={() => receiveMutation.mutate()}
                    disabled={receiveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {receiveMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        Receiving…
                      </>
                    ) : (
                      <>
                        <PackageCheck className="h-4 w-4 mr-1.5" />
                        Mark as Received
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
