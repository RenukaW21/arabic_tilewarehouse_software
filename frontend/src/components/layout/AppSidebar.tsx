import { useMemo, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/api/axios";
import {
  LayoutDashboard,
  Building2,
  Package,
  ShoppingCart,
  Warehouse,
  Receipt,
  BarChart3,
  AlertTriangle,
  Settings,
  ChevronDown,
  ChevronRight,
  Users,
  Boxes,
  Layers,
  Tag,
  Truck,
  ClipboardList,
  FileText,
  CreditCard,
  ArrowLeftRight,
  PackageMinus,
  ClipboardCheck,
  ReceiptText,
  BadgeDollarSign,
  LogOut,
  ScrollText,
  Factory,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/api/usersApi";
import { useTranslation } from "react-i18next";

interface NavChild {
  labelKey: string;
  path: string;
  icon: React.ElementType;
  allowedRoles?: UserRole[];
}

interface NavItem {
  labelKey: string;
  icon: React.ElementType;
  path?: string;
  children?: NavChild[];
  badge?: number;
  allowedRoles?: UserRole[];
}

const ALL_ROLES: UserRole[] = ['super_admin', 'admin', 'warehouse_manager', 'sales', 'accountant', 'user'];

function canSeeNavItem(item: NavItem | NavChild, userRole: string): boolean {
  const roles = item.allowedRoles ?? ALL_ROLES;
  return roles.includes(userRole as UserRole);
}

function filterNavByRole(items: NavItem[], userRole: string): NavItem[] {
  return items
    .filter((item) => canSeeNavItem(item, userRole))
    .map((item) => {
      if (!item.children) return item;
      const filteredChildren = item.children.filter((c) =>
        canSeeNavItem(c, userRole)
      );
      if (filteredChildren.length === 0) return null;
      return { ...item, children: filteredChildren };
    })
    .filter((item): item is NavItem => item != null);
}

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: alerts = [] } = useQuery({
    queryKey: ["dashboard_low_stock_alerts"],
    queryFn: async () => {
      const res = await axiosInstance.get("/alerts/low-stock");
      const data = res.data.data;
      if (!data) return [];
      return Array.isArray(data) ? data : [data];
    },
  });

  const navItems = useMemo<NavItem[]>(
    () => [
      { labelKey: "nav.dashboard", icon: LayoutDashboard, path: "/", allowedRoles: ALL_ROLES },

      {
        labelKey: "nav.setup",
        icon: Building2,
        allowedRoles: ["super_admin", "admin"],
        children: [
          { labelKey: "nav.gstConfig", path: "/setup/company", icon: ReceiptText },
          { labelKey: "nav.warehouses", path: "/setup/warehouses", icon: Warehouse },
          { labelKey: "nav.racks", path: "/setup/racks", icon: Layers },
          { labelKey: "nav.users", path: "/setup/users", icon: Users },
        ],
      },

      {
        labelKey: "nav.master",
        icon: Package,
        allowedRoles: ["super_admin", "admin", "warehouse_manager", "sales", "accountant"],
        children: [
          { labelKey: "nav.products", path: "/master/products", icon: Boxes },
          { labelKey: "nav.categories", path: "/master/categories", icon: Tag },
          { labelKey: "nav.vendors", path: "/master/vendors", icon: Factory },
          { labelKey: "nav.customers", path: "/master/customers", icon: Users },
        ],
      },

      {
        labelKey: "nav.purchase",
        icon: ShoppingCart,
        allowedRoles: ["super_admin", "admin", "warehouse_manager"],
        children: [
          { labelKey: "nav.orders", path: "/purchase/orders", icon: ClipboardList },
          { labelKey: "nav.grn", path: "/purchase/grn", icon: ClipboardCheck },
          { labelKey: "nav.returns", path: "/purchase/returns", icon: PackageMinus },
        ],
      },

      {
        labelKey: "nav.inventory",
        icon: Warehouse,
        allowedRoles: ["super_admin", "admin", "warehouse_manager"],
        children: [
          { labelKey: "nav.productInventory", path: "/inventory/product-inventory", icon: Layers },
          { labelKey: "nav.stock", path: "/inventory/stock", icon: Boxes },
          { labelKey: "nav.ledger", path: "/inventory/ledger", icon: ScrollText },
          { labelKey: "nav.transfers", path: "/inventory/transfers", icon: ArrowLeftRight },
          { labelKey: "nav.adjustments", path: "/inventory/adjustments", icon: Settings },
          { labelKey: "nav.damage", path: "/inventory/damage", icon: AlertTriangle },
          { labelKey: "nav.stockCount", path: "/inventory/counts", icon: ClipboardCheck },
        ],
      },

      {
        labelKey: "nav.sales",
        icon: Receipt,
        allowedRoles: ["super_admin", "admin", "warehouse_manager", "sales", "accountant"],
        children: [
          {
            labelKey: "nav.orders",
            path: "/sales/orders",
            icon: ClipboardList,
            allowedRoles: ["super_admin", "admin", "warehouse_manager", "sales", "accountant"],
          },
          {
            labelKey: "nav.pickLists",
            path: "/sales/pick-lists",
            icon: ClipboardCheck,
            allowedRoles: ["super_admin", "admin", "warehouse_manager", "sales"],
          },
          {
            labelKey: "nav.challans",
            path: "/sales/challans",
            icon: Truck,
            allowedRoles: ["super_admin", "admin", "warehouse_manager"],
          },
          {
            labelKey: "nav.invoices",
            path: "/sales/invoices",
            icon: FileText,
            allowedRoles: ["super_admin", "admin", "accountant"],
          },
          {
            labelKey: "nav.returns",
            path: "/sales/returns",
            icon: PackageMinus,
            allowedRoles: ["super_admin", "admin", "warehouse_manager"],
          },
        ],
      },

      {
        labelKey: "nav.accounts",
        icon: CreditCard,
        allowedRoles: ["super_admin", "admin", "accountant"],
        children: [
          { labelKey: "nav.received", path: "/accounts/received", icon: BadgeDollarSign },
          { labelKey: "nav.paid", path: "/accounts/paid", icon: CreditCard },
          { labelKey: "nav.creditNotes", path: "/accounts/credit-notes", icon: FileText },
          { labelKey: "nav.debitNotes", path: "/accounts/debit-notes", icon: FileText },
        ],
      },

      {
        labelKey: "nav.reports",
        icon: BarChart3,
        allowedRoles: ["super_admin", "admin", "accountant"],
        children: [
          { labelKey: "nav.gstReport", path: "/reports/gst", icon: ReceiptText },
          { labelKey: "nav.revenue", path: "/reports/revenue", icon: BarChart3 },
          { labelKey: "nav.aging", path: "/reports/aging", icon: ScrollText },
        ],
      },

      {
        labelKey: "nav.alerts",
        icon: AlertTriangle,
        path: "/alerts",
        badge: alerts.length,
        allowedRoles: ALL_ROLES,
      },

      {
        labelKey: "nav.settings",
        icon: Settings,
        path: "/settings",
        allowedRoles: ["super_admin", "admin"],
      },

      { labelKey: "nav.logout", icon: LogOut },
    ],
    [alerts.length]
  );

  const navFiltered = useMemo(
    () => filterNavByRole(navItems, user?.role ?? "user"),
    [navItems, user?.role]
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navFiltered.forEach((item) => {
      if (item.children?.some((c) => location.pathname === c.path)) {
        initial[item.labelKey] = true;
      }
    });
    return initial;
  });

  const toggleGroup = (labelKey: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [labelKey]: !prev[labelKey],
    }));
  };

  const isActive = (path?: string) => path === location.pathname;

  const isGroupActive = (item: NavItem) =>
    item.children?.some((c) => location.pathname === c.path);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
    window.location.reload();
  };

  return (
    <aside
      className={cn(
        "h-svh shrink-0 overflow-hidden bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border shrink-0">
        <Boxes className="h-7 w-7 text-sidebar-primary shrink-0" />

        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <h1 className="font-display font-bold text-sm text-sidebar-primary-foreground leading-tight">
              {t('app.name')}
            </h1>
            <p className="text-[10px] text-sidebar-foreground/60">
              {t('app.tagline')}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
        {navFiltered.map((item) => (
          <div key={item.labelKey}>
            {item.labelKey === "nav.logout" ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{t(item.labelKey)}</span>}
              </button>
            ) : item.path ? (
              <Link
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive(item.path)
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />

                {!collapsed && (
                  <span className="truncate">{t(item.labelKey)}</span>
                )}

                {!collapsed && item.badge && (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            ) : (
              <>
                <button
                  onClick={() => toggleGroup(item.labelKey)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isGroupActive(item)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />

                  {!collapsed && (
                    <>
                      <span className="truncate flex-1 text-left">
                        {t(item.labelKey)}
                      </span>

                      {openGroups[item.labelKey] ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </>
                  )}
                </button>

                {!collapsed && openGroups[item.labelKey] && item.children && (
                  <div className="ml-4 pl-3 border-l border-sidebar-border/40 mt-0.5 space-y-0.5">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors",
                          isActive(child.path)
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <child.icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{t(child.labelKey)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-sidebar-border">
          <div className="bg-sidebar-accent rounded-lg p-3">
            <p className="text-[10px] text-sidebar-foreground/60 font-medium">
              {t('app.tenant')}
            </p>
            <p className="text-xs text-sidebar-foreground font-semibold truncate">
              {user?.tenantSlug ?? t('app.workspace')}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50">
              {user?.role ?? "User"}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}