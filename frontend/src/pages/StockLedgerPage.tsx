import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stockApi } from '@/api/reportApi';
import { warehouseApi } from '@/api/warehouseApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTableShell } from '@/components/shared/DataTableShell';
import type { StockLedgerEntry, StockLedgerParams, StockTransactionType } from '@/types/stock.types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function StockLedgerPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [type, setType] = useState<StockTransactionType | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const TRANSACTION_TYPES: { value: StockTransactionType; label: string }[] = [
    { value: 'GRN', label: t('stockLedger.grnLabel') },
    { value: 'SALES_DISPATCH', label: t('stockLedger.salesDispatch') },
    { value: 'ADJUSTMENT_IN', label: t('stockLedger.adjustmentIn') },
    { value: 'ADJUSTMENT_OUT', label: t('stockLedger.adjustmentOut') },
    { value: 'TRANSFER_IN', label: t('stockLedger.transferIn') },
    { value: 'TRANSFER_OUT', label: t('stockLedger.transferOut') },
    { value: 'RETURN_IN', label: t('stockLedger.returnIn') },
    { value: 'DAMAGE', label: t('stockLedger.damage') },
  ];

  const params: StockLedgerParams = {
    page,
    limit: 25,
    ...(productId && { productId }),
    ...(warehouseId && { warehouseId }),
    ...(type && { type }),
    ...(from && { from }),
    ...(to && { to }),
  };

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses', { limit: 500 }],
    queryFn: () => warehouseApi.getAll({ limit: 500 }),
  });
  const warehouses = warehousesData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['stock-ledger', params],
    queryFn: () => stockApi.getLedger(params),
  });

  const entries: StockLedgerEntry[] = data?.data ?? [];
  const meta = data?.meta ?? null;

  const columns = [
    { key: 'transaction_date', label: t('stockLedger.date'), render: (r: StockLedgerEntry) => formatDate(r.transaction_date) },
    { key: 'product_code', label: t('stockLedger.product'), render: (r: StockLedgerEntry) => r.product_code ?? '—' },
    { key: 'warehouse_name', label: t('stockLedger.warehouse'), render: (r: StockLedgerEntry) => r.warehouse_name ?? '—' },
    { key: 'transaction_type', label: t('stockLedger.type'), render: (r: StockLedgerEntry) => <span className="font-medium">{r.transaction_type}</span> },
    { key: 'qty_boxes_in', label: t('stockLedger.in'), render: (r: StockLedgerEntry) => (Number(r.qty_boxes_in) > 0 ? Number(r.qty_boxes_in) : '—') },
    { key: 'qty_boxes_out', label: t('stockLedger.out'), render: (r: StockLedgerEntry) => (Number(r.qty_boxes_out) > 0 ? Number(r.qty_boxes_out) : '—') },
    { key: 'balance_boxes', label: t('stockLedger.balance'), render: (r: StockLedgerEntry) => <span className="font-mono font-medium">{Number(r.balance_boxes)}</span> },
    { key: 'reference_number', label: t('stockLedger.reference'), render: (r: StockLedgerEntry) => r.reference_number ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t('stockLedger.title')} subtitle={t('stockLedger.subtitle')} />

      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">{t('stockLedger.warehouse')}</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={warehouseId}
            onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}
          >
            <option value="">{t('common.all')}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('stockLedger.type')}</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={type}
            onChange={(e) => { setType(e.target.value as StockTransactionType | ''); setPage(1); }}
          >
            <option value="">{t('common.all')}</option>
            {TRANSACTION_TYPES.map((tx) => (
              <option key={tx.value} value={tx.value}>{tx.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('stockLedger.fromDate')}</Label>
          <Input type="date" className="h-9 w-40" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('stockLedger.toDate')}</Label>
          <Input type="date" className="h-9 w-40" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setProductId(''); setWarehouseId(''); setType(''); setFrom(''); setTo(''); setPage(1); }}>
          {t('common.clearFilters')}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-[400px] w-full rounded-md" />
      ) : (
        <DataTableShell<StockLedgerEntry>
          data={entries}
          columns={columns}
          paginationMeta={meta}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      )}
      {!isLoading && entries.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">{t('stockLedger.noEntries')}</p>
      )}
    </div>
  );
}
