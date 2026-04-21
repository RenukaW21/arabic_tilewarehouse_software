import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import type { UserRole } from "@/types/auth.types";

/** Block direct URL navigation to routes the user's role cannot access. */
function RoleGuard({ allow, children }: { allow: UserRole[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !allow.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Pages
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import ProductsPage from "@/pages/ProductsPage";
import ProductDetailsPage from "@/pages/ProductDetailsPage";
import CategoriesPage from "@/pages/CategoriesPage";
import VendorsPage from "@/pages/VendorsPage";
import CustomersPage from "@/pages/CustomersPage";
import WarehousesPage from "@/pages/WarehousesPage";
import RacksPage from "@/pages/RacksPage";
import PurchaseOrdersPage from "@/pages/PurchaseOrdersPage";
import PurchaseOrderDetailsPage from "@/pages/PurchaseOrderDetailsPage";
import GRNPage from "@/pages/GRNPage";
import GRNDetailPage from "@/pages/GRNDetailPage";
import SalesOrdersPage from "@/pages/SalesOrdersPage";
import InventoryStockPage from "@/pages/InventoryStockPage";
import ProductInventoryPage from "@/pages/ProductInventoryPage";
import StockTransfersPage from "@/pages/StockTransfersPage";
import StockAdjustmentsPage from "@/pages/StockAdjustmentsPage";
import DamageEntriesPage from "@/pages/DamageEntriesPage";
import InvoicesPage from "@/pages/InvoicesPage";
import AlertsPage from "@/pages/AlertsPage";
import PickListsPage from "@/pages/PickListsPage";
import DeliveryChallansPage from "@/pages/DeliveryChallansPage";
import SalesReturnsPage from "@/pages/SalesReturnsPage";
import PurchaseReturnsPage from "@/pages/PurchaseReturnsPage";
import PaymentsReceivedPage from "@/pages/PaymentsReceivedPage";
import PaymentsMadePage from "@/pages/PaymentsMadePage";
import CreditNotesPage from "@/pages/CreditNotesPage";
import DebitNotesPage from "@/pages/DebitNotesPage";
import SettingsPage from "@/pages/SettingsPage";
import UsersPage from "@/pages/UsersPage";
import GstConfigurationPage from "@/pages/setup/GstConfigurationPage";
import StockCountsPage, { StockCountDetailPage } from "@/pages/StockCountsPage";
import StockLedgerPage from "@/pages/StockLedgerPage";
import GSTReportPage from "@/pages/GSTReportPage";
import RevenueReportPage from "@/pages/RevenueReportPage";
import AgingReportPage from "@/pages/AgingReportPage";
import WarehouseDetailPage from "@/pages/WarehouseDetailPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  // 🔄 Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        {t("app.loading")}
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<AuthPage />} />
      
      {/* Protected Routes */}
      <Route element={user ? <DashboardLayout /> : <Navigate to="/login" />}>
        {/* ── All roles ── */}
        <Route path="/" element={<DashboardPage />} />
        <Route path="/master/products" element={<ProductsPage />} />
        <Route path="/master/products/:id" element={<ProductDetailsPage />} />
        <Route path="/master/categories" element={<CategoriesPage />} />
        <Route path="/alerts" element={<AlertsPage />} />

        {/* ── Admin / Setup ── */}
        <Route path="/setup/company" element={<RoleGuard allow={["super_admin","admin"]}><GstConfigurationPage /></RoleGuard>} />
        <Route path="/setup/warehouses" element={<RoleGuard allow={["super_admin","admin"]}><WarehousesPage /></RoleGuard>} />
        <Route path="/setup/warehouses/:id" element={<RoleGuard allow={["super_admin","admin"]}><WarehouseDetailPage /></RoleGuard>} />
        <Route path="/setup/racks" element={<RoleGuard allow={["super_admin","admin"]}><RacksPage /></RoleGuard>} />
        <Route path="/setup/users" element={<RoleGuard allow={["super_admin","admin"]}><UsersPage /></RoleGuard>} />
        <Route path="/settings" element={<RoleGuard allow={["super_admin","admin"]}><SettingsPage /></RoleGuard>} />

        {/* ── Master data ── */}
        <Route path="/master/vendors" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","accountant","viewer"]}><VendorsPage /></RoleGuard>} />
        <Route path="/master/customers" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","sales","accountant","viewer"]}><CustomersPage /></RoleGuard>} />

        {/* ── Purchase ── */}
        <Route path="/purchase/orders" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","accountant","viewer"]}><PurchaseOrdersPage /></RoleGuard>} />
        <Route path="/purchase/orders/:id" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","accountant","viewer"]}><PurchaseOrderDetailsPage /></RoleGuard>} />
        <Route path="/purchase/grn" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","warehouse_staff","viewer"]}><GRNPage /></RoleGuard>} />
        <Route path="/purchase/grn/:id" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","warehouse_staff","viewer"]}><GRNDetailPage /></RoleGuard>} />
        <Route path="/purchase/returns" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor"]}><PurchaseReturnsPage /></RoleGuard>} />

        {/* ── Inventory ── */}
        <Route path="/inventory/product-inventory" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","warehouse_staff","accountant","viewer"]}><ProductInventoryPage /></RoleGuard>} />
        <Route path="/inventory/stock" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","warehouse_staff","accountant","viewer"]}><InventoryStockPage /></RoleGuard>} />
        <Route path="/inventory/ledger" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","accountant","viewer"]}><StockLedgerPage /></RoleGuard>} />
        <Route path="/inventory/transfers" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","viewer"]}><StockTransfersPage /></RoleGuard>} />
        <Route path="/inventory/adjustments" element={<RoleGuard allow={["super_admin","admin","warehouse_manager"]}><StockAdjustmentsPage /></RoleGuard>} />
        <Route path="/inventory/damage" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor"]}><DamageEntriesPage /></RoleGuard>} />
{/* 
        <Route path="/inventory/counts" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","warehouse_staff"]}><StockCountsPage /></RoleGuard>} />
        <Route path="/inventory/counts/:id" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","warehouse_staff"]}><StockCountDetailPage /></RoleGuard>} />
*/}

        {/* ── Sales ── */}
        <Route path="/sales/orders" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","sales","accountant","viewer"]}><SalesOrdersPage /></RoleGuard>} />
        <Route path="/sales/pick-lists" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","warehouse_staff","sales"]}><PickListsPage /></RoleGuard>} />
        <Route path="/sales/challans" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","warehouse_staff","accountant","viewer"]}><DeliveryChallansPage /></RoleGuard>} />
        <Route path="/sales/invoices" element={<RoleGuard allow={["super_admin","admin","accountant","viewer"]}><InvoicesPage /></RoleGuard>} />
        <Route path="/sales/returns" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","supervisor","warehouse_staff","accountant","viewer"]}><SalesReturnsPage /></RoleGuard>} />

        {/* ── Accounts ── */}
        <Route path="/accounts/received" element={<RoleGuard allow={["super_admin","admin","accountant","viewer"]}><PaymentsReceivedPage /></RoleGuard>} />
        <Route path="/accounts/paid" element={<RoleGuard allow={["super_admin","admin","accountant","viewer"]}><PaymentsMadePage /></RoleGuard>} />
        <Route path="/accounts/credit-notes" element={<RoleGuard allow={["super_admin","admin","accountant","viewer"]}><CreditNotesPage /></RoleGuard>} />
        <Route path="/accounts/debit-notes" element={<RoleGuard allow={["super_admin","admin","accountant","viewer"]}><DebitNotesPage /></RoleGuard>} />

        {/* ── Reports ── */}
        <Route path="/reports/gst" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","accountant","viewer"]}><GSTReportPage /></RoleGuard>} />
        <Route path="/reports/revenue" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","accountant","viewer"]}><RevenueReportPage /></RoleGuard>} />
        <Route path="/reports/aging" element={<RoleGuard allow={["super_admin","admin","warehouse_manager","accountant","viewer"]}><AgingReportPage /></RoleGuard>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;