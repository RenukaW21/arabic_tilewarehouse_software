import { useMemo, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Package, ShoppingCart, Warehouse,
  Receipt, BarChart3, AlertTriangle, Settings, ChevronDown, ChevronRight,
  Users, Boxes, Layers, Tag, Truck, ClipboardList, FileText, CreditCard,
  ArrowLeftRight, PackageMinus, ClipboardCheck, ReceiptText, BadgeDollarSign,LogOut,
  ScrollText, Factory
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/api/usersApi';




interface NavChild {
  label: string;
  path: string;
  icon: React.ElementType;
  allowedRoles?: UserRole[];
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  children?: NavChild[];
  badge?: number;
  allowedRoles?: UserRole[];
}

const ALL_ROLES: UserRole[] = ['super_admin', 'admin', 'warehouse_manager', 'sales', 'accountant', 'user'];

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', allowedRoles: ALL_ROLES },
  {
    label: 'Setup', icon: Building2, allowedRoles: ['super_admin', 'admin'],
    children: [
      { label: 'GST Config', path: '/setup/company', icon: ReceiptText },
      { label: 'Warehouses', path: '/setup/warehouses', icon: Warehouse },
      { label: 'Racks', path: '/setup/racks', icon: Layers },
      { label: 'Users', path: '/setup/users', icon: Users },
    ]
  },
  {
    label: 'Master', icon: Package, allowedRoles: ['super_admin', 'admin', 'warehouse_manager', 'sales', 'accountant'],
    children: [
      { label: 'Products', path: '/master/products', icon: Boxes },
      { label: 'Categories', path: '/master/categories', icon: Tag },
      { label: 'Vendors', path: '/master/vendors', icon: Factory },
      { label: 'Customers', path: '/master/customers', icon: Users },
    ]
  },
  {
    label: 'Purchase', icon: ShoppingCart, allowedRoles: ['super_admin', 'admin', 'warehouse_manager'],
    children: [
      { label: 'Orders', path: '/purchase/orders', icon: ClipboardList },
      { label: 'GRN', path: '/purchase/grn', icon: ClipboardCheck },
      { label: 'Returns', path: '/purchase/returns', icon: PackageMinus },
    ]
  },
  {
    label: 'Inventory', icon: Warehouse, allowedRoles: ['super_admin', 'admin', 'warehouse_manager'],
    children: [
      { label: 'Rack Inventory', path: '/inventory/rack-inventory', icon: Layers },
      { label: 'Stock', path: '/inventory/stock', icon: Boxes },
      { label: 'Ledger', path: '/inventory/ledger', icon: ScrollText },
      { label: 'Transfers', path: '/inventory/transfers', icon: ArrowLeftRight },
      { label: 'Adjustments', path: '/inventory/adjustments', icon: Settings },
      { label: 'Damage', path: '/inventory/damage', icon: AlertTriangle },
      { label: 'Stock Count', path: '/inventory/counts', icon: ClipboardCheck },
    ]
  },
  {
    label: 'Sales', icon: Receipt, allowedRoles: ['super_admin', 'admin', 'warehouse_manager', 'sales', 'accountant'],
    children: [
      { label: 'Orders', path: '/sales/orders', icon: ClipboardList, allowedRoles: ['super_admin', 'admin', 'warehouse_manager', 'sales', 'accountant'] },
      { label: 'Pick Lists', path: '/sales/pick-lists', icon: ClipboardCheck, allowedRoles: ['super_admin', 'admin', 'warehouse_manager', 'sales'] },
      { label: 'Challans', path: '/sales/challans', icon: Truck, allowedRoles: ['super_admin', 'admin', 'warehouse_manager'] },
      { label: 'Invoices', path: '/sales/invoices', icon: FileText, allowedRoles: ['super_admin', 'admin', 'accountant'] },
      { label: 'Returns', path: '/sales/returns', icon: PackageMinus, allowedRoles: ['super_admin', 'admin', 'warehouse_manager'] },
    ]
  },
  {
    label: 'Accounts', icon: CreditCard, allowedRoles: ['super_admin', 'admin', 'accountant'],
    children: [
      { label: 'Received', path: '/accounts/received', icon: BadgeDollarSign },
      { label: 'Paid', path: '/accounts/paid', icon: CreditCard },
      { label: 'Credit Notes', path: '/accounts/credit-notes', icon: FileText },
      { label: 'Debit Notes', path: '/accounts/debit-notes', icon: FileText },
    ]
  },
  {
    label: 'Reports', icon: BarChart3, allowedRoles: ['super_admin', 'admin', 'accountant'],
    children: [
      { label: 'GST Report', path: '/reports/gst', icon: ReceiptText },
      { label: 'Revenue', path: '/reports/revenue', icon: BarChart3 },
      { label: 'Aging', path: '/reports/aging', icon: ScrollText },
    ]
  },
  // { label: 'Alerts', icon: AlertTriangle, path: '/alerts', badge: 1, allowedRoles: ALL_ROLES },
  { label: 'Settings', icon: Settings, path: '/settings', allowedRoles: ['super_admin', 'admin'] },
  { label: 'Logout', icon: LogOut },
  
];



function canSeeNavItem(item: NavItem | NavChild, userRole: string): boolean {
  const roles = item.allowedRoles ?? ALL_ROLES;
  return roles.includes(userRole as UserRole);
}

function filterNavByRole(items: NavItem[], userRole: string): NavItem[] {
  return items
    .filter((item) => canSeeNavItem(item, userRole))
    .map((item) => {
      if (!item.children) return item;
      const filteredChildren = item.children.filter((c) => canSeeNavItem(c, userRole));
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
  const { user } = useAuth();
  const navFiltered = useMemo(
    () => filterNavByRole(navItems, user?.role ?? 'user'),
    [user?.role]
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navFiltered.forEach(item => {
      if (item.children?.some(c => location.pathname === c.path)) {
        initial[item.label] = true;
      }
    });
    return initial;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (path?: string) => path === location.pathname;
  const isGroupActive = (item: NavItem) => item.children?.some(c => location.pathname === c.path);

  const navigate = useNavigate();

const handleLogout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  navigate("/login");
};

  return (
    <aside className={cn(
      "h-svh shrink-0 overflow-hidden bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 border-r border-sidebar-border",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border shrink-0">
        <Boxes className="h-7 w-7 text-sidebar-primary shrink-0" />
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <h1 className="font-display font-bold text-sm text-sidebar-primary-foreground leading-tight">Tiles WMS</h1>
            <p className="text-[10px] text-sidebar-foreground/60">Warehouse Management</p>
          </div>
        )}
      </div>

      {/* Nav - min-h-0 allows flex child to shrink; scrollbar hidden via global .sidebar-nav */}
      <nav className="sidebar-nav min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
        {navFiltered.map(item => (
          <div key={item.label}>
                {item.label === "Logout" ? (
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full"
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
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
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && item.badge && (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            ) : (
              <>
                <button
                  onClick={() => toggleGroup(item.label)}
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
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      {openGroups[item.label] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </>
                  )}
                </button>
                {!collapsed && openGroups[item.label] && item.children && (
                  <div className="ml-4 pl-3 border-l border-sidebar-border/40 mt-0.5 space-y-0.5">
                    {item.children.map(child => (
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
                        <span>{child.label}</span>
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
            <p className="text-[10px] text-sidebar-foreground/60 font-medium">TENANT</p>
            <p className="text-xs text-sidebar-foreground font-semibold truncate">{user?.tenantSlug ?? 'Workspace'}</p>
            <p className="text-[10px] text-sidebar-foreground/50">{user?.role ?? 'User'}</p>
          </div>
        </div>
      )}
    </aside>
  );
}
