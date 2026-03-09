import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '@/api/reportApi';
import { RadialBarChart, RadialBar, ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts';
import { AlertTriangle, CheckCircle, Clock, IndianRupee, Phone } from 'lucide-react';

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const BUCKET_COLORS: Record<string, string> = {
    current: '#22c55e',
    days1_30: '#f59e0b',
    days31_60: '#f97316',
    days61_90: '#ef4444',
    days90plus: '#dc2626',
};

const BUCKET_LABELS: Record<string, string> = {
    current: '0–30 Days (Not Yet Due)',
    days1_30: '1–30 Days Overdue',
    days31_60: '31–60 Days Overdue',
    days61_90: '61–90 Days Overdue',
    days90plus: '90+ Days Overdue',
};

function RiskBadge({ days }: { days: number }) {
    if (days <= 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle className="h-3 w-3" />Current</span>;
    if (days <= 30) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><Clock className="h-3 w-3" />{days}d</span>;
    if (days <= 60) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><AlertTriangle className="h-3 w-3" />{days}d</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle className="h-3 w-3" />{days}d</span>;
}

export default function AgingReportPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeView, setActiveView] = useState<'summary' | 'invoices'>('summary');

    const { data: res, isLoading } = useQuery({
        queryKey: ['aging-report'],
        queryFn: () => reportApi.getAgingReport(),
    });

    const report = res?.data as any;
    const buckets = report?.summary ?? {};
    const totalOutstanding = report?.totalOutstanding ?? 0;
    const customerWise: any[] = report?.customerWise ?? [];
    const invoices: any[] = report?.invoices ?? [];

    const pieData = Object.entries(buckets)
        .map(([key, val]) => ({ name: BUCKET_LABELS[key], value: Number(val), key }))
        .filter(d => d.value > 0);

    const criticalCustomers = customerWise.filter(c => c.days90plus > 0);

    const filteredInvoices = useMemo(() =>
        invoices.filter(r =>
            !searchTerm ||
            r.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
        ), [invoices, searchTerm]
    );

    const filteredCustomers = useMemo(() =>
        customerWise.filter(c =>
            !searchTerm || c.customer?.toLowerCase().includes(searchTerm.toLowerCase())
        ), [customerWise, searchTerm]
    );

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold font-display">Accounts Receivable Aging</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Track outstanding customer payments and overdue invoices</p>
                </div>
                <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                    {[{ id: 'summary', label: 'Customer Summary' }, { id: 'invoices', label: 'Invoice Detail' }].map(v => (
                        <button
                            key={v.id}
                            onClick={() => setActiveView(v.id as any)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeView === v.id ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
                </div>
            ) : (
                <>
                    {/* Bucket Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        {Object.entries(BUCKET_LABELS).map(([key, label]) => {
                            const val = (buckets as any)[key] ?? 0;
                            const pct = totalOutstanding > 0 ? ((val / totalOutstanding) * 100).toFixed(1) : 0;
                            const color = BUCKET_COLORS[key];
                            return (
                                <div key={key} className="bg-card border rounded-xl p-4 shadow-sm">
                                    <div className="h-1 rounded-full mb-3" style={{ backgroundColor: color }} />
                                    <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                                    <p className="text-lg font-bold mt-1">{fmt(val)}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{pct}% of total</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Main cards row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Pie chart */}
                        <div className="bg-card border rounded-xl p-5 shadow-sm">
                            <h3 className="text-sm font-semibold mb-1">Aging Distribution</h3>
                            <p className="text-xs text-muted-foreground mb-3">Total Outstanding: <span className="font-bold text-foreground">{fmt(totalOutstanding)}</span></p>
                            {pieData.length === 0 ? (
                                <div className="h-48 flex items-center justify-center text-muted-foreground">
                                    <CheckCircle className="h-8 w-8 mr-2 text-emerald-500" />
                                    <p className="text-sm">No outstanding invoices</p>
                                </div>
                            ) : (
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                                                {pieData.map((entry) => (
                                                    <Cell key={entry.key} fill={BUCKET_COLORS[entry.key]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v: any) => fmt(v)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                            <div className="space-y-1.5 mt-2">
                                {pieData.map(d => (
                                    <div key={d.key} className="flex items-center gap-2 text-xs">
                                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: BUCKET_COLORS[d.key] }} />
                                        <span className="text-muted-foreground truncate flex-1">{BUCKET_LABELS[d.key]}</span>
                                        <span className="font-medium">{fmt(d.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Critical accounts */}
                        <div className="lg:col-span-2 bg-card border rounded-xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <h3 className="text-sm font-semibold">High-Risk Accounts (90+ Days Overdue)</h3>
                                <span className="ml-auto bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">{criticalCustomers.length}</span>
                            </div>
                            {criticalCustomers.length === 0 ? (
                                <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
                                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                                    <p className="text-sm">No high-risk accounts</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {criticalCustomers.map((c: any) => (
                                        <div key={c.customer} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                                            <div>
                                                <p className="text-sm font-medium">{c.customer}</p>
                                                {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{c.phone}</p>}
                                            </div>
                                            <div className="text-right ml-4">
                                                <p className="text-sm font-bold text-red-600">{fmt(c.days90plus)}</p>
                                                <p className="text-xs text-muted-foreground">Total: {fmt(c.total)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b gap-3 flex-wrap">
                            <h3 className="text-sm font-semibold">
                                {activeView === 'summary' ? `Customer Aging Summary (${customerWise.length})` : `Outstanding Invoices (${invoices.length})`}
                            </h3>
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder={activeView === 'summary' ? 'Search customer...' : 'Search invoice or customer...'}
                                className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary w-64"
                            />
                        </div>
                        <div className="overflow-x-auto">
                            {activeView === 'summary' ? (
                                filteredCustomers.length === 0 ? (
                                    <p className="text-center py-12 text-muted-foreground">No outstanding balances found</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                {['Customer', '0–30 (Current)', '1–30 Overdue', '31–60 Overdue', '61–90 Overdue', '90+ Overdue', 'Total'].map(h => (
                                                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCustomers.map((c: any) => (
                                                <tr key={c.customer} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 font-medium">{c.customer}</td>
                                                    <td className="px-4 py-3 text-right text-emerald-600">{fmt(c.current)}</td>
                                                    <td className="px-4 py-3 text-right text-amber-600">{fmt(c.days1_30)}</td>
                                                    <td className="px-4 py-3 text-right text-orange-600">{fmt(c.days31_60)}</td>
                                                    <td className="px-4 py-3 text-right text-red-500">{fmt(c.days61_90)}</td>
                                                    <td className="px-4 py-3 text-right font-medium text-red-700">{fmt(c.days90plus)}</td>
                                                    <td className="px-4 py-3 text-right font-bold">{fmt(c.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )
                            ) : (
                                filteredInvoices.length === 0 ? (
                                    <p className="text-center py-12 text-muted-foreground">No outstanding invoices found</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                {['Invoice #', 'Customer', 'Invoice Date', 'Due Date', 'Overdue', 'Grand Total', 'Outstanding'].map(h => (
                                                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredInvoices.map((r: any, i: number) => (
                                                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 font-mono font-medium text-primary">{r.invoice_number}</td>
                                                    <td className="px-4 py-3">{r.customer_name}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(r.invoice_date).toLocaleDateString('en-IN')}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(r.due_date).toLocaleDateString('en-IN')}</td>
                                                    <td className="px-4 py-3"><RiskBadge days={parseInt(r.days_overdue || 0)} /></td>
                                                    <td className="px-4 py-3 text-right">{fmt(r.grand_total)}</td>
                                                    <td className="px-4 py-3 text-right font-semibold">{fmt(r.outstanding)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
