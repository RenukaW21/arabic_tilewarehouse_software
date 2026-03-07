import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '@/api/reportApi';
import { FileText, IndianRupee, Receipt, Hash } from 'lucide-react';

const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const CURR_YEAR = new Date().getFullYear();
const CURR_MONTH = new Date().getMonth() + 1;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = [CURR_YEAR, CURR_YEAR - 1, CURR_YEAR - 2];

function StatCard({ label, value, icon: Icon, color }: any) {
    return (
        <div className="bg-card border rounded-xl p-5 shadow-sm flex items-start gap-4">
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                <p className="text-xl font-bold mt-1 truncate">{value}</p>
            </div>
        </div>
    );
}

export default function GSTReportPage() {
    const [month, setMonth] = useState(CURR_MONTH);
    const [year, setYear] = useState(CURR_YEAR);

    const { data: res, isLoading } = useQuery({
        queryKey: ['gst-report', month, year],
        queryFn: () => reportApi.getGSTReport({ month, year }),
    });

    const reportData = res?.data as any;
    const invoices: any[] = reportData?.invoices ?? [];
    const hsnSummary: any[] = reportData?.hsnSummary ?? [];
    const summary = reportData?.summary ?? {};

    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'invoices' | 'hsn'>('invoices');

    const filtered = useMemo(() =>
        invoices.filter(r =>
            !searchTerm ||
            r.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.customer_gstin?.toLowerCase().includes(searchTerm.toLowerCase())
        ), [invoices, searchTerm]
    );

    return (
        <div className="flex flex-col gap-6">
            {/* Header with filters */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold font-display">GST Report</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">GSTR-1 style invoice-wise tax summary</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={month}
                        onChange={e => setMonth(Number(e.target.value))}
                        className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <select
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                        className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
                </div>
            ) : (
                <>
                    {/* Summary KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="Total Invoices" value={summary.totalInvoices ?? 0} icon={FileText} color="bg-blue-500" />
                        <StatCard label="Taxable Amount" value={fmt(summary.taxableAmount)} icon={IndianRupee} color="bg-amber-500" />
                        <StatCard label="CGST + SGST" value={fmt((summary.cgst ?? 0) + (summary.sgst ?? 0))} icon={Receipt} color="bg-purple-500" />
                        <StatCard label="Grand Total" value={fmt(summary.grandTotal)} icon={Hash} color="bg-emerald-500" />
                    </div>

                    {/* Main Content */}
                    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                        {/* Tabs + Search */}
                        <div className="flex items-center justify-between border-b px-4 gap-4 flex-wrap">
                            <div className="flex">
                                {[{ id: 'invoices', label: `Invoices (${invoices.length})` }, { id: 'hsn', label: `HSN Summary (${hsnSummary.length})` }].map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setActiveTab(t.id as any)}
                                        className={`px-4 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            {activeTab === 'invoices' && (
                                <input
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Search invoice, customer, GSTIN..."
                                    className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary my-2 w-72"
                                />
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            {activeTab === 'invoices' ? (
                                filtered.length === 0 ? (
                                    <div className="text-center py-16 text-muted-foreground">
                                        <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                        <p>No invoices found for {MONTHS[month - 1]} {year}</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                {['Invoice #', 'Date', 'Customer', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'].map(h => (
                                                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((r: any, i: number) => (
                                                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 font-mono font-medium text-primary">{r.invoice_number}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(r.invoice_date).toLocaleDateString('en-IN')}</td>
                                                    <td className="px-4 py-3 max-w-36 truncate">{r.customer_name}</td>
                                                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.customer_gstin || '—'}</td>
                                                    <td className="px-4 py-3 text-right whitespace-nowrap">{fmt(r.sub_total)}</td>
                                                    <td className="px-4 py-3 text-right whitespace-nowrap text-blue-600">{fmt(r.cgst_amount)}</td>
                                                    <td className="px-4 py-3 text-right whitespace-nowrap text-purple-600">{fmt(r.sgst_amount)}</td>
                                                    <td className="px-4 py-3 text-right whitespace-nowrap text-amber-600">{fmt(r.igst_amount)}</td>
                                                    <td className="px-4 py-3 text-right whitespace-nowrap font-semibold">{fmt(r.grand_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-muted/50 border-t-2">
                                                <td colSpan={4} className="px-4 py-3 text-sm font-semibold">Total ({filtered.length} invoices)</td>
                                                <td className="px-4 py-3 text-right font-semibold">{fmt(filtered.reduce((s, r) => s + parseFloat(r.sub_total || 0), 0))}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-blue-600">{fmt(filtered.reduce((s, r) => s + parseFloat(r.cgst_amount || 0), 0))}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-purple-600">{fmt(filtered.reduce((s, r) => s + parseFloat(r.sgst_amount || 0), 0))}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-amber-600">{fmt(filtered.reduce((s, r) => s + parseFloat(r.igst_amount || 0), 0))}</td>
                                                <td className="px-4 py-3 text-right font-bold">{fmt(filtered.reduce((s, r) => s + parseFloat(r.grand_total || 0), 0))}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                )
                            ) : (
                                hsnSummary.length === 0 ? (
                                    <div className="text-center py-16 text-muted-foreground">
                                        <Hash className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                        <p>No HSN data for {MONTHS[month - 1]} {year}</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                {['HSN Code', 'Product', 'Boxes', 'Taxable', 'CGST', 'SGST', 'IGST'].map(h => (
                                                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {hsnSummary.map((r: any, i: number) => (
                                                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 font-mono font-medium">{r.hsn_code}</td>
                                                    <td className="px-4 py-3">{r.product_name}</td>
                                                    <td className="px-4 py-3 text-right">{Number(r.total_boxes || 0).toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right">{fmt(r.taxable_amount)}</td>
                                                    <td className="px-4 py-3 text-right text-blue-600">{fmt(r.cgst_amount)}</td>
                                                    <td className="px-4 py-3 text-right text-purple-600">{fmt(r.sgst_amount)}</td>
                                                    <td className="px-4 py-3 text-right text-amber-600">{fmt(r.igst_amount)}</td>
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
