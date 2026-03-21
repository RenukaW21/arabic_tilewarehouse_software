import {
  IndianRupee,
  ShoppingCart,
  Package,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  Users,
  Truck,
  Layers,
} from "lucide-react";
import { KPICard } from "@/components/shared/KPICard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/useDashboardData";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Link, useSearchParams } from "react-router-dom";
import type {
  DashboardLowStockItem,
  DashboardRecentSale,
  DashboardRecentPurchase,
  DashboardRecentGRN,
  DashboardRecentTransfer,
} from "@/types/stock.types";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useTranslation } from "react-i18next";

const CHART_COLORS = [
  "hsl(217, 91%, 53%)",
  "hsl(160, 84%, 30%)",
  "hsl(38, 92%, 50%)",
  "hsl(213, 52%, 25%)",
  "hsl(280, 60%, 50%)",
];

function formatCurrency(val: number): string {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const { t } = useTranslation();

  const { data: alerts = [] } = useQuery({
    queryKey: ["dashboard_low_stock_alerts"],
    queryFn: async () => {
      const res = await api.get(`/alerts/low-stock`);
      const data = res.data.data;
      if (!data) return [];
      return Array.isArray(data) ? data : [data];
    },
  });

  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useDashboard();

  const summary = data?.summary;
  const kpis = data?.kpis;
  const recentSales: DashboardRecentSale[] = data?.recentSales ?? [];
  const recentPurchases: DashboardRecentPurchase[] = data?.recentPurchases ?? [];
  const recentGRNs: DashboardRecentGRN[] = data?.recentGRNs ?? [];
  const recentTransfers: DashboardRecentTransfer[] = data?.recentTransfers ?? [];
  const lowStock: DashboardLowStockItem[] = data?.lowStock ?? [];
  const stockByCategory = data?.stockByCategory ?? [];

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-medium text-destructive">
          {error instanceof Error ? error.message : t('dashboard.failedToLoadDashboard')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))
        ) : (
          <>
            <div onClick={() => navigate("/setup/warehouses")} className="cursor-pointer">
              <KPICard
                title={t('dashboard.warehouses')}
                value={String(summary?.totalWarehouses ?? 0)}
                icon={<Layers className="h-5 w-5" />}
                variant="default"
              />
            </div>

            <div onClick={() => navigate("/master/products")} className="cursor-pointer">
              <KPICard
                title={t('dashboard.products')}
                value={String(summary?.totalProducts ?? 0)}
                icon={<Package className="h-5 w-5" />}
                variant="primary"
              />
            </div>

            <div onClick={() => navigate("/master/vendors")} className="cursor-pointer">
              <KPICard
                title={t('dashboard.vendors')}
                value={String(summary?.totalVendors ?? 0)}
                icon={<Truck className="h-5 w-5" />}
                variant="default"
              />
            </div>
            <div onClick={() => navigate("/master/customers")} className="cursor-pointer">
              <KPICard
                title={t('dashboard.customers')}
                value={String(summary?.totalCustomers ?? 0)}
                icon={<Users className="h-5 w-5" />}
                variant="default"
              />
            </div>
            <div onClick={() => navigate("/purchase/orders")} className="cursor-pointer">
              <KPICard
                title={t('dashboard.pendingPOs')}
                value={String(summary?.pendingPurchaseOrders ?? 0)}
                icon={<ShoppingCart className="h-5 w-5" />}
                variant="warning"
              />
            </div>

            <div onClick={() => navigate("/inventory/stock")} className="cursor-pointer">
              <KPICard
                title={t('dashboard.totalStock')}
                value={String(summary?.totalStock ?? 0)}
                icon={<Layers className="h-5 w-5" />}
                variant="default"
              />
            </div>

            <div onClick={() => navigate("/sales/orders")} className="cursor-pointer">
              <KPICard
                title={t('dashboard.salesThisMonth')}
                value={formatCurrency(summary?.monthlySales ?? 0)}
                icon={<TrendingUp className="h-5 w-5" />}
                variant="success"
              />
            </div>

            <div onClick={() => navigate("/purchase/orders")} className="cursor-pointer">
              <KPICard
                title={t('dashboard.purchasesThisMonth')}
                value={formatCurrency(summary?.monthlyPurchases ?? 0)}
                icon={<ShoppingCart className="h-5 w-5" />}
                variant="warning"
              />
            </div>
          </>
        )}
      </div>

      {/* Secondary KPIs */}
      {!isLoading &&
        (kpis?.lowStockItems !== undefined ||
          kpis?.activePOs !== undefined ||
          summary?.ledgerEntriesLast30Days !== undefined) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div onClick={() => navigate("/alerts")} className="cursor-pointer">
              <KPICard
                title={t('dashboard.lowStockItems')}
                value={String(alerts.length)}
                icon={<AlertTriangle className="h-5 w-5" />}
                variant="danger"
              />
            </div>

            <KPICard
              title={t('dashboard.activePOs')}
              value={String(kpis?.activePOs ?? 0)}
              icon={<ShoppingCart className="h-5 w-5" />}
              variant="warning"
            />
            <KPICard
              title={t('dashboard.ledgerEntries30d')}
              value={String(summary?.ledgerEntriesLast30Days ?? 0)}
              icon={<Layers className="h-5 w-5" />}
              variant="default"
            />
          </div>
        )}

      {/* Charts + Recent tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stock by category */}
        <div className="bg-card rounded-lg border p-4 shadow-sm">
          <h3 className="font-display font-semibold text-foreground mb-4">
            {t('dashboard.stockByCategory')}
          </h3>
          {isLoading ? (
            <Skeleton className="h-[200px] w-full rounded-md" />
          ) : stockByCategory.filter((d) => d.boxes > 0).length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stockByCategory
                      .map((d) => ({
                        ...d,
                        boxes: Number(d.boxes),
                      }))
                      .filter((d) => d.boxes > 0)}
                    dataKey="boxes"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {stockByCategory
                      .filter((d) => d.boxes > 0)
                      .map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(214, 32%, 91%)",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {stockByCategory.map((item, i) => (
                  <div
                    key={item.category}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                      <span className="text-muted-foreground">
                        {item.category}
                      </span>
                    </div>
                    <span className="font-medium text-foreground">
                      {item.boxes} {t('common.boxes')}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('dashboard.noStockData')}
            </p>
          )}
        </div>

        {/* Recent Sales */}
        <div className="lg:col-span-2 bg-card rounded-lg border shadow-sm">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-display font-semibold text-foreground">
              {t('dashboard.recentSales')}
            </h3>
            <Link
              to="/sales/orders"
              className="text-xs text-secondary hover:underline flex items-center gap-0.5"
            >
              {t('common.viewAll')} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium">{t('dashboard.order')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('dashboard.customer')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('common.date')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('common.status')}</th>
                    <th className="text-right px-4 py-2.5 font-medium">{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center text-muted-foreground py-6 text-sm"
                      >
                        {t('dashboard.noSalesOrders')}
                      </td>
                    </tr>
                  ) : (
                    recentSales.map((so) => (
                      <tr
                        key={so.id}
                        className="border-t border-border hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">
                          {so.so_number}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {so.customer_name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatDate(so.order_date)}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={so.status} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">
                          {formatCurrency(Number(so.grand_total))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Recent GRNs + Recent Transfers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border shadow-sm">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-display font-semibold text-foreground">
              {t('dashboard.recentGRNs')}
            </h3>
            <Link
              to="/purchase/grn"
              className="text-xs text-secondary hover:underline flex items-center gap-0.5"
            >
              {t('common.viewAll')} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium">{t('dashboard.grn')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('dashboard.vendor')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('dashboard.warehouse')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('common.date')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGRNs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center text-muted-foreground py-6 text-sm"
                      >
                        {t('dashboard.noGRNs')}
                      </td>
                    </tr>
                  ) : (
                    recentGRNs.map((g) => (
                      <tr
                        key={g.id}
                        className="border-t border-border hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">
                          {g.grn_number}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {g.vendor_name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {g.warehouse_name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatDate(g.receipt_date)}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={g.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="bg-card rounded-lg border shadow-sm">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-display font-semibold text-foreground">
              {t('dashboard.recentTransfers')}
            </h3>
            <Link
              to="/inventory/transfers"
              className="text-xs text-secondary hover:underline flex items-center gap-0.5"
            >
              {t('common.viewAll')} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium">{t('dashboard.transfer')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('dashboard.fromTo')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('common.date')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransfers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center text-muted-foreground py-6 text-sm"
                      >
                        {t('dashboard.noTransfers')}
                      </td>
                    </tr>
                  ) : (
                    recentTransfers.map((t_) => (
                      <tr
                        key={t_.id}
                        className="border-t border-border hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">
                          {t_.transfer_number}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {t_.from_warehouse_name ?? "—"} →{" "}
                          {t_.to_warehouse_name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatDate(t_.transfer_date)}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={t_.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Recent Purchases + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Purchases */}
        <div className="lg:col-span-2 bg-card rounded-lg border shadow-sm">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-display font-semibold text-foreground">
              {t('dashboard.recentPurchases')}
            </h3>
            <Link
              to="/purchase/orders"
              className="text-xs text-secondary hover:underline flex items-center gap-0.5"
            >
              {t('common.viewAll')} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium">{t('dashboard.po')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('dashboard.vendor')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('common.date')}</th>
                    <th className="text-left px-4 py-2.5 font-medium">{t('common.status')}</th>
                    <th className="text-right px-4 py-2.5 font-medium">{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPurchases.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center text-muted-foreground py-6 text-sm"
                      >
                        {t('dashboard.noPurchaseOrders')}
                      </td>
                    </tr>
                  ) : (
                    recentPurchases.map((po) => (
                      <tr
                        key={po.id}
                        className="border-t border-border hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">
                          <Link
                            to={`/purchase/orders/${po.id}`}
                            className="text-primary hover:underline"
                          >
                            {po.po_number}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {po.vendor_name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatDate(po.order_date)}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={po.status} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-foreground">
                          {formatCurrency(Number(po.grand_total))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Low Stock */}
        <div className="bg-card rounded-lg border shadow-sm">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> {t('dashboard.lowStock')}
            </h3>
            <Link
              to="/alerts"
              className="text-xs text-secondary hover:underline"
            >
              {t('common.viewAll')}
            </Link>
          </div>

          <div className="p-2 space-y-1">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('dashboard.noAlerts')}
              </p>
            ) : (
              alerts.slice(0, 5).map((alert: any) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between px-6 py-2 rounded-md hover:bg-muted/30 transition-colors "
                >
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {alert.product_code}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                      {alert.product_name}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-destructive">
                      {alert.current_stock_boxes}{" "}
                      <span className="text-[10px] text-muted-foreground">
                        /{alert.reorder_level_boxes}
                      </span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
