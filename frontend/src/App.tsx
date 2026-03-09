import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import ProductsPage from "@/pages/ProductsPage";
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
import StockPage from "@/pages/StockPage";
import InventoryStockPage from "@/pages/InventoryStockPage";
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
import PlaceholderPage from "@/pages/PlaceholderPage";
import UsersPage from "@/pages/UsersPage";
import GstConfigurationPage from "@/pages/setup/GstConfigurationPage";
import StockCountsPage from "@/pages/StockCountsPage";
import { StockCountDetailPage } from "@/pages/StockCountsPage";
import StockLedgerPage from "@/pages/StockLedgerPage";
import NotFound from "@/pages/NotFound";
import GSTReportPage from "@/pages/GSTReportPage";
import RevenueReportPage from "@/pages/RevenueReportPage";
import AgingReportPage from "@/pages/AgingReportPage";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading...</div>;
  if (!user) return <AuthPage />;

  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/master/products" element={<ProductsPage />} />
        <Route path="/master/categories" element={<CategoriesPage />} />
        <Route path="/master/vendors" element={<VendorsPage />} />
        <Route path="/master/customers" element={<CustomersPage />} />
        <Route path="/purchase/orders" element={<PurchaseOrdersPage />} />
        <Route path="/purchase/orders/:id" element={<PurchaseOrderDetailsPage />} />
        <Route path="/purchase/grn" element={<GRNPage />} />
        <Route path="/purchase/grn/:id" element={<GRNDetailPage />} />
        <Route path="/purchase/returns" element={<PurchaseReturnsPage />} />
        <Route path="/inventory/stock" element={<InventoryStockPage />} />
        <Route path="/inventory/ledger" element={<StockLedgerPage />} />
        <Route path="/inventory/transfers" element={<StockTransfersPage />} />
        <Route path="/inventory/adjustments" element={<StockAdjustmentsPage />} />
        <Route path="/inventory/damage" element={<DamageEntriesPage />} />
        <Route path="/inventory/counts" element={<StockCountsPage />} />
        <Route path="/inventory/counts/:id" element={<StockCountDetailPage />} />
        <Route path="/sales/orders" element={<SalesOrdersPage />} />
        <Route path="/sales/pick-lists" element={<PickListsPage />} />
        <Route path="/sales/challans" element={<DeliveryChallansPage />} />
        <Route path="/sales/invoices" element={<InvoicesPage />} />
        <Route path="/sales/returns" element={<SalesReturnsPage />} />
        <Route path="/accounts/received" element={<PaymentsReceivedPage />} />
        <Route path="/accounts/paid" element={<PaymentsMadePage />} />
        <Route path="/accounts/credit-notes" element={<CreditNotesPage />} />
        <Route path="/accounts/debit-notes" element={<DebitNotesPage />} />
        <Route path="/reports/gst" element={<GSTReportPage />} />
        <Route path="/reports/revenue" element={<RevenueReportPage />} />
        <Route path="/reports/aging" element={<AgingReportPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="/setup/company" element={<GstConfigurationPage />} />
        <Route path="/setup/warehouses" element={<WarehousesPage />} />
        <Route path="/setup/racks" element={<RacksPage />} />
        <Route path="/setup/users" element={<UsersPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
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
