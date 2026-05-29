import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '@/api/reportApi';
import { useTranslation } from 'react-i18next';
import {
  Package, TrendingDown, IndianRupee, Layers, Download, Filter, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt   = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN  = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const TYPE_LABELS: Record<string, string> = {
  sale:                'Sale Dispatch',
  damage:              'Damage',
  adjustment:          'Adjustment',
  transfer_out:        'Transfer Out',
  production_material: 'Production Material',
};

const TYPE_COLORS: Record<string, string> = {
  sale:                '#3b82f6',
  damage:              '#ef4444',
  adjustment:          '#f59e0b',
  transfer_out:        '#8b5cf6',
  production_material: '#10b981',
};

const MOVEMENT_TYPES = Object.keys(TYPE_LABELS);

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-card border rounded-xl p-5 shadow-sm flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InventoryConsumptionReportPage() {
  const { t } = useTranslation();

  const [from,            setFrom]            = useState('');
  const [to,              setTo]              = useState('');
  const [productId,       setProductId]       = useState('');
  const [warehouseId,     setWarehouseId]     = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [search,          setSearch]          = useState('');
  const [exporting,       setExporting]       = useState(false);

  const params = {
    ...(from            && { from }),
    ...(to              && { to }),
    ...(productId       && { productId }),
    ...(warehouseId     && { warehouseId }),
    ...(transactionType && { transactionType }),
  };

  const hasFilters = from || to || productId || warehouseId || transactionType;

  const { data: res, isLoading } = useQuery({
    queryKey: ['inventory-consumption', params],
    queryFn:  () => reportApi.getInventoryConsumption(params),
  });

  const summary = (res?.data as any)?.summary ?? {};
  const rows: any[]  = (res?.data as any)?.rows ?? [];

  // search filter (client-side)
  const filtered = rows.filter(r =>
    !search ||
    r.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.product_code?.toLowerCase().includes(search.toLowerCase()) ||
    r.warehouse_name?.toLowerCase().includes(search.toLowerCase())
  );

  // movement-type breakdown for bar chart
  const breakdownMap: Record<string, { qty: number; value: number }> = {};
  for (const r of rows) {
    const t = r.transaction_type || 'other';
    if (!breakdownMap[t]) breakdownMap[t] = { qty: 0, value: 0 };
    breakdownMap[t].qty   += parseFloat(r.qty_consumed  || 0);
    breakdownMap[t].value += parseFloat(r.total_value   || 0);
  }
  const chartData = Object.entries(breakdownMap).map(([type, d]) => ({
    type: TYPE_LABELS[type] || type,
    rawType: type,
    qty:   +d.qty.toFixed(2),
    value: +d.value.toFixed(2),
  }));

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await reportApi.exportInventoryConsumption(params);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `inventory-consumption-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('consumptionReport.exportSuccess'));
    } catch {
      toast.error(t('consumptionReport.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setFrom(''); setTo(''); setProductId(''); setWarehouseId(''); setTransactionType(''); setSearch('');
  };

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">{t('consumptionReport.title')}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t('consumptionReport.subtitle')}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60 transition-colors"
        >
          <Download className="h-4 w-4" />
          {exporting ? t('consumptionReport.exporting') : t('consumptionReport.exportExcel')}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="bg-card border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Filters</span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> {t('consumptionReport.clearFilters')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">{t('consumptionReport.filterFrom')}</label>
            <input
              type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border rounded-md px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">{t('consumptionReport.filterTo')}</label>
            <input
              type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border rounded-md px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">{t('consumptionReport.filterType')}</label>
            <select
              value={transactionType} onChange={e => setTransactionType(e.target.value)}
              className="border rounded-md px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{t('consumptionReport.allTypes')}</option>
              {MOVEMENT_TYPES.map(type => (
                <option key={type} value={type}>{TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
            <label className="text-xs text-muted-foreground font-medium">Search</label>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Product name or code…"
              className="border rounded-md px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={t('consumptionReport.totalConsumed')}
            value={fmtN(summary.totalQtyConsumed ?? 0)}
            sub="boxes consumed"
            icon={TrendingDown}
            color="bg-blue-500"
          />
          <StatCard
            label={t('consumptionReport.totalSqft')}
            value={fmtN(summary.totalSqftConsumed ?? 0)}
            sub="sqft consumed"
            icon={Layers}
            color="bg-purple-500"
          />
          <StatCard
            label={t('consumptionReport.totalValue')}
            value={fmt(summary.totalValue ?? 0)}
            sub="at avg cost"
            icon={IndianRupee}
            color="bg-amber-500"
          />
          <StatCard
            label={t('consumptionReport.uniqueProducts')}
            value={String(summary.uniqueProducts ?? 0)}
            sub={`${summary.totalRows ?? 0} total entries`}
            icon={Package}
            color="bg-emerald-500"
          />
        </div>
      )}

      {/* ── Movement Breakdown Chart ── */}
      {!isLoading && chartData.length > 0 && (
        <div className="bg-card border rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">{t('consumptionReport.movementBreakdown')}</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtN(v)} />
                <Tooltip
                  formatter={(val: number, name: string) =>
                    name === 'qty' ? [`${fmtN(val)} boxes`, 'Qty Consumed'] : [fmt(val), 'Total Value']
                  }
                />
                <Bar dataKey="qty" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.rawType} fill={TYPE_COLORS[entry.rawType] ?? '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Data Table ── */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('consumptionReport.title')}</h3>
          <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            <div className="animate-pulse">Loading consumption data…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            {t('consumptionReport.noData')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('consumptionReport.colDate')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('consumptionReport.colProductCode')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('consumptionReport.colProductName')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('consumptionReport.colWarehouse')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('consumptionReport.colType')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('consumptionReport.colQtyConsumed')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('consumptionReport.colSqft')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('consumptionReport.colUnitCost')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('consumptionReport.colTotalValue')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('consumptionReport.colBalance')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row: any, idx: number) => {
                  const typeColor = TYPE_COLORS[row.transaction_type] ?? '#94a3b8';
                  const typeLabel = TYPE_LABELS[row.transaction_type] ?? row.transaction_type;
                  return (
                    <tr key={row.id ?? idx} className={`border-b transition-colors hover:bg-muted/30 ${idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {row.transaction_date ? new Date(row.transaction_date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{row.product_code}</span>
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[200px] truncate">{row.product_name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{row.warehouse_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
                          style={{ backgroundColor: typeColor }}
                        >
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {fmtN(parseFloat(row.qty_consumed || 0))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {fmtN(parseFloat(row.sqft_consumed || 0))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {fmt(parseFloat(row.unit_cost || 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">
                        {fmt(parseFloat(row.total_value || 0))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {fmtN(parseFloat(row.balance_boxes || 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr className="border-t-2 bg-muted/40">
                  <td colSpan={5} className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">Totals</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    {fmtN(filtered.reduce((s: number, r: any) => s + parseFloat(r.qty_consumed || 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    {fmtN(filtered.reduce((s: number, r: any) => s + parseFloat(r.sqft_consumed || 0), 0))}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-primary">
                    {fmt(filtered.reduce((s: number, r: any) => s + parseFloat(r.total_value || 0), 0))}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
