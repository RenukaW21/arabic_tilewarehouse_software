import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '@/api/reportApi';
import { PageHeader } from '@/components/shared/PageHeader';
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, IndianRupee, Package, Users, ShoppingCart } from 'lucide-react';

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtNum = (n: number) => Number(n || 0).toLocaleString('en-IN');

function StatCard({ label, value, sub, icon: Icon, trend, color }: any) {
    return (
        <div className={`bg-card border rounded-xl p-5 shadow-sm flex items-start gap-4`}>
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold mt-0.5 truncate">{value}</p>
                {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            </div>
            {trend !== undefined && (
                <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
    );
}

const MONTHS_OPTIONS = [3, 6, 12, 24];

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
        return (
            <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                <p className="font-semibold text-foreground mb-1">{label}</p>
                {payload.map((p: any) => (
                    <p key={p.name} style={{ color: p.color }}>
                        {p.name}: {p.name === 'Revenue' || p.name === 'Tax' ? fmt(p.value) : fmtNum(p.value)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function RevenueReportPage() {
    const [months, setMonths] = useState(12);
    const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'customers'>('overview');

    const { data: res, isLoading } = useQuery({
        queryKey: ['revenue-report', months],
        queryFn: () => reportApi.getRevenueReport({ months }),
    });

    const monthly = (res?.data as any)?.monthly ?? [];
    const topProducts = (res?.data as any)?.topProducts ?? [];
    const topCustomers = (res?.data as any)?.topCustomers ?? [];

    const totalRevenue = useMemo(() => monthly.reduce((s: number, r: any) => s + parseFloat(r.revenue || 0), 0), [monthly]);
    const totalTax = useMemo(() => monthly.reduce((s: number, r: any) => s + parseFloat(r.tax_collected || 0), 0), [monthly]);
    const totalInvoices = useMemo(() => monthly.reduce((s: number, r: any) => s + parseInt(r.invoice_count || 0), 0), [monthly]);
    const avgMonthly = monthly.length ? totalRevenue / monthly.length : 0;

    const chartData = monthly.map((r: any) => ({
        month: r.month,
        Revenue: parseFloat(r.revenue || 0),
        Tax: parseFloat(r.tax_collected || 0),
        Invoices: parseInt(r.invoice_count || 0),
    }));

    const tabs = [
        { id: 'overview', label: 'Monthly Trend' },
        { id: 'products', label: 'Top Products' },
        { id: 'customers', label: 'Top Customers' },
    ];

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold font-display">Revenue Report</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Sales revenue analysis and trends</p>
                </div>
                <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                    {MONTHS_OPTIONS.map(m => (
                        <button
                            key={m}
                            onClick={() => setMonths(m)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${months === m ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {m}M
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="Total Revenue" value={fmt(totalRevenue)} sub={`Last ${months} months`} icon={IndianRupee} color="bg-blue-500" />
                        <StatCard label="Tax Collected" value={fmt(totalTax)} sub="GST collected" icon={TrendingUp} color="bg-purple-500" />
                        <StatCard label="Total Invoices" value={fmtNum(totalInvoices)} sub="Issued invoices" icon={Package} color="bg-amber-500" />
                        <StatCard label="Avg Monthly" value={fmt(avgMonthly)} sub="Per month average" icon={ShoppingCart} color="bg-emerald-500" />
                    </div>

                    {/* Tabs */}
                    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                        <div className="flex border-b">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-6">
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-muted-foreground mb-4">Revenue vs Tax Trend</h3>
                                        <div className="h-72">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                                    <defs>
                                                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="taxGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                                    <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                                                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                                                    <Legend />
                                                    <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" />
                                                    <Area type="monotone" dataKey="Tax" stroke="#8b5cf6" strokeWidth={2} fill="url(#taxGrad)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-muted-foreground mb-4">Invoice Count per Month</h3>
                                        <div className="h-48">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                                    <YAxis tick={{ fontSize: 12 }} />
                                                    <Tooltip content={<CUSTOM_TOOLTIP />} />
                                                    <Bar dataKey="Invoices" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'products' && (
                                <div>
                                    <h3 className="text-sm font-semibold text-muted-foreground mb-4">Top 10 Products by Revenue</h3>
                                    {topProducts.length === 0 ? (
                                        <p className="text-muted-foreground text-center py-12">No product data available</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {topProducts.map((p: any, i: number) => {
                                                const maxRev = parseFloat(topProducts[0].revenue || 1);
                                                const pct = (parseFloat(p.revenue || 0) / maxRev) * 100;
                                                return (
                                                    <div key={p.code} className="flex items-center gap-3">
                                                        <span className="w-5 text-xs text-muted-foreground font-mono text-right">{i + 1}</span>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-sm font-medium truncate">{p.name}</span>
                                                                <span className="text-sm font-semibold text-primary ml-2 shrink-0">{fmt(p.revenue)}</span>
                                                            </div>
                                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-0.5">{fmtNum(p.boxes_sold)} boxes sold</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'customers' && (
                                <div>
                                    <h3 className="text-sm font-semibold text-muted-foreground mb-4">Top 10 Customers by Revenue</h3>
                                    {topCustomers.length === 0 ? (
                                        <p className="text-muted-foreground text-center py-12">No customer data available</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {topCustomers.map((c: any, i: number) => {
                                                const maxRev = parseFloat(topCustomers[0].total_revenue || 1);
                                                const pct = (parseFloat(c.total_revenue || 0) / maxRev) * 100;
                                                return (
                                                    <div key={c.code} className="flex items-center gap-3">
                                                        <span className="w-5 text-xs text-muted-foreground font-mono text-right">{i + 1}</span>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-sm font-medium truncate">{c.name}</span>
                                                                <span className="text-sm font-semibold text-primary ml-2 shrink-0">{fmt(c.total_revenue)}</span>
                                                            </div>
                                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-0.5">{c.invoice_count} invoices</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
