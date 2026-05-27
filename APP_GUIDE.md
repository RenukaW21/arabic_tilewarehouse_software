# Tiles Warehouse Management System — Complete App Guide

A full-stack, multi-tenant enterprise Warehouse Management System (WMS) built for tile distribution businesses.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express.js |
| Database | MySQL (via mysql2/promise) |
| Auth | JWT (access + refresh tokens) |
| Frontend | React 18 + TypeScript + Vite |
| UI Library | shadcn/ui (Radix UI) + Tailwind CSS |
| State | React Context + React Query |
| HTTP Client | Axios |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| i18n | i18next |
| AI | OpenAI API |

---

## Project Structure Overview

```
arabic_tilewarehouse_software/
├── backend/          → REST API server
└── frontend/         → React SPA
```

---

## BACKEND

### Entry Point & App Setup

#### `backend/index.js`
Server entry point. Starts the HTTP server on the configured port, connects to the database, and registers handlers for graceful shutdown (`SIGTERM`, `SIGINT`) so in-flight requests finish before the process exits.

#### `backend/src/app.js`
Creates the Express app. Registers all global middleware (helmet for security headers, CORS, compression, JSON body parser, rate limiters, logging). Then mounts every module's router under its API path (e.g. `/api/products`, `/api/grn`, etc.).

---

### Config

#### `backend/src/config/db.js`
Creates a MySQL connection pool using `mysql2/promise`. Exports:
- `query(sql, params)` — run a single query
- `beginTransaction()` / `commit()` / `rollback()` — wrap multiple queries in an atomic transaction
- `getConnection()` — get a raw connection for long operations

#### `backend/src/config/env.js`
Loads and validates all environment variables (database credentials, JWT secrets, server port, OpenAI key). Centralizes config so nothing reads `process.env` directly elsewhere.

#### `backend/src/config/migrate.js`
Runs the SQL migration script (`schema.sql`) to create all 44 tables in a fresh database. Run once on first deploy.

#### `backend/src/config/seed.js`
Inserts sample/fixture data into the database for development and testing.

---

### Constants

#### `backend/src/constants/roles.js`
Defines all valid user roles as constants:
`super_admin`, `admin`, `warehouse_manager`, `supervisor`, `sales`, `accountant`, `warehouse_staff`, `viewer`, `user`.
Used by middleware to check if a user has the right role for an action.

---

### Middlewares

#### `backend/src/middlewares/auth.middleware.js`
Verifies the JWT `Authorization: Bearer <token>` header on every protected route. Decodes the token, loads the user from DB, and attaches `req.user` and `req.tenantId` for downstream handlers. Returns 401 if the token is missing, expired, or invalid.

#### `backend/src/middlewares/tenant.middleware.js`
Ensures every database query is scoped to the current tenant. Reads `req.tenantId` (set by auth middleware) and can inject it automatically. Prevents cross-tenant data leakage.

#### `backend/src/middlewares/role.middleware.js`
Factory: `requireRole(...roles)` — returns a middleware that checks `req.user.role` against the allowed list. Returns 403 if the user's role is not permitted.

#### `backend/src/middlewares/permission.middleware.js`
Fine-grained permission checks beyond role. Used for specific operations (e.g. "can approve GRN") where role alone isn't enough.

#### `backend/src/middlewares/warehouse-scope.middleware.js`
Checks that the authenticated user has access to the specific warehouse being requested. Warehouse managers and staff are scoped to their assigned warehouses; admins can access all.

#### `backend/src/middlewares/error.middleware.js`
Global error handler (last middleware in the stack). Catches all thrown errors, maps them to HTTP status codes, and returns a standardized JSON error response. Handles `AppError` (custom), Joi validation errors, and unexpected errors.

#### `backend/src/middlewares/rateLimiter.middleware.js`
Two rate limiters:
- **General** — 100 requests per 15 minutes per IP
- **Auth** — 10 requests per 15 minutes per IP (applied to `/api/auth` routes)

#### `backend/src/middlewares/upload.middleware.js`
Configures `multer` for file uploads (images, documents). Sets storage destination, file size limits, and allowed MIME types.

#### `backend/src/middlewares/csvUpload.middleware.js`
Configures `multer` specifically for CSV imports. Parses and validates CSV rows before passing them to the controller.

---

### Utilities

#### `backend/src/utils/logger.js`
Winston logger with two formats:
- **Dev** — colorized, human-readable console output
- **Prod** — JSON structured logs for log aggregation tools

#### `backend/src/utils/response.js`
Standardized response helpers:
- `sendSuccess(res, data, message, statusCode)` — wraps data in `{ success: true, data, message }`
- `sendError(res, message, statusCode, errors)` — wraps errors in `{ success: false, message, errors }`
- `sendPaginated(res, data, pagination)` — adds `pagination: { total, page, limit, totalPages }` to response

#### `backend/src/utils/pagination.js`
Extracts `page`, `limit`, `sortBy`, `sortOrder` from query params. Returns SQL `LIMIT`/`OFFSET` values and builds `ORDER BY` clause safely.

#### `backend/src/utils/docNumber.js`
Generates sequential, collision-free document numbers (e.g. `PO-2024-001`, `GRN-2024-045`). Uses a locked `document_counters` table row so concurrent requests never get the same number.

#### `backend/src/utils/auditLog.js`
`logAudit(userId, tenantId, action, entityType, entityId, before, after, req)` — writes a record to `audit_logs` with the before/after JSON values, IP address, and user agent. Called in every create/update/delete service.

#### `backend/src/utils/stockHelper.js`
Core stock movement utilities:
- `addStockLedgerEntry(...)` — appends a row to the immutable `stock_ledger` table
- `updateStockSummary(...)` — increments/decrements the `stock_summary` snapshot
- Used by GRN posting, sales order fulfilment, adjustments, transfers, damage entries, and returns

#### `backend/src/utils/stockReservation.js`
- `reserveStock(salesOrderId, items, tenantId, conn)` — locks available quantity in `stock_reservations` when a sales order is confirmed, preventing overselling
- `releaseReservation(salesOrderId, conn)` — frees reserved qty when an order is cancelled or fully invoiced

#### `backend/src/utils/deleteGuard.js`
`guardDelete(tableName, id, tenantId)` — checks foreign key references before deleting a master record (e.g. can't delete a product that has GRN items). Returns a descriptive error listing which related records block the deletion.

#### `backend/src/utils/validators.js`
Common Joi schemas reused across modules: UUID format, date ranges, positive integers, GST number pattern, phone number, email, etc.

---

### Database

#### `backend/src/database/schema.sql`
Full MySQL DDL for all 44 tables. Key groups:
- **Tenant & Users** — `tenants`, `users`
- **Master Data** — `products`, `product_categories`, `shades`, `batches`, `warehouses`, `racks`, `customers`, `vendors`
- **Purchasing** — `purchase_orders`, `purchase_order_items`
- **Receiving** — `goods_receipt_notes`, `grn_items`
- **Sales** — `sales_orders`, `sales_order_items`, `invoices`, `invoice_items`
- **Stock** — `stock_ledger`, `stock_summary`, `stock_reservations`, `rack_inventory`
- **Operations** — `pick_lists`, `delivery_challans`, `stock_transfers`, `stock_adjustments`, `stock_counts`, `damage_entries`
- **Returns** — `sales_returns`, `purchase_returns`
- **Financials** — `customer_payments`, `vendor_payments`, `credit_notes`, `debit_notes`
- **System** — `audit_logs`, `notifications`, `low_stock_alerts`, `document_counters`, `ai_chat_history`, `barcode_labels`, `gst_config`

---

### Modules

Each module follows the pattern: `routes.js → controller.js → service.js → repository.js`.

---

#### `modules/auth/`
Handles user authentication and session management.
- **routes** — `POST /login`, `POST /register`, `POST /refresh-token`, `POST /logout`, `GET /profile`, `PUT /change-password`
- **controller** — validates request bodies, calls service, returns tokens
- **service** — `login`: verifies password with bcrypt, issues access + refresh JWT pair. `refreshToken`: validates refresh token, issues new access token. `register`: creates new tenant + admin user. `changePassword`: compares old password before updating hash.

---

#### `modules/products/`
Product master data management.
- **routes** — `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`
- **service** — CRUD with `deleteGuard` check before deletion. Enforces unique product codes per tenant. Soft-delete supported.
- **repository** — Joins `products` with `product_categories`. Returns shade and batch counts per product.

---

#### `modules/categories/`
Product category CRUD. Simple master table with name + description, tenant-scoped.

---

#### `modules/vendors/`
Vendor master CRUD. Stores contact info, GST number, bank details. CSV import supported. `deleteGuard` prevents deletion if POs exist.

---

#### `modules/customers/`
Customer master CRUD. Stores billing/shipping address, GST number, credit limit. CSV import (`POST /import-csv`) via `csvUpload` middleware. `deleteGuard` prevents deletion if sales orders exist.

---

#### `modules/warehouses/`
Warehouse facility management.
- **routes** — standard CRUD + `GET /:id/racks`
- **service** — tracks capacity (total vs used). On creation assigns a default rack section. `deleteGuard` prevents deletion if stock exists.

---

#### `modules/racks/`
Rack/bin management within a warehouse. Stores aisle, row, column, capacity. `auto-assign` endpoint picks the best available rack for a product based on empty capacity.

---

#### `modules/purchase-orders/`
Full PO lifecycle.
- **Create** — generates `PO-YYYY-NNN` number, saves header + line items in a transaction
- **Receive** — links a GRN to close the PO
- **Status flow** — `draft → confirmed → partially_received → received → cancelled`
- Line item totals auto-calculated on save

---

#### `modules/grn/`
Goods Receipt Notes — the critical inbound stock movement.
- **Create** — saves GRN header + items (pending quality check)
- **Quality Check** — `PUT /:id/items/:itemId/quality-check` marks each item `passed` or `failed` with quantity
- **Post to Stock** — `PUT /:id/post` atomic transaction:
  1. For each passed item: calls `stockHelper.addStockLedgerEntry` and `stockHelper.updateStockSummary`
  2. Updates GRN status to `posted`
  3. Updates linked PO received quantities
  4. Creates `low_stock_alerts` if any product was already below reorder point

---

#### `modules/sales-orders/`
Sales order creation and confirmation.
- **Create** — generates `SO-YYYY-NNN`, saves header + line items, checks available stock
- **Confirm** — `PUT /:id/confirm` atomic transaction:
  1. Calls `stockReservation.reserveStock` to lock inventory
  2. Auto-generates a pick list
  3. Updates status to `confirmed`
- **Cancel** — releases reservations via `stockReservation.releaseReservation`
- **Status flow** — `draft → confirmed → picking → packed → invoiced → cancelled`

---

#### `modules/invoices/`
GST invoice generation from confirmed/packed sales orders.
- **Generate** — `POST /generate/:salesOrderId` atomic transaction:
  1. Calculates GST per line item (CGST+SGST if same state, IGST if different state, based on `gst_config.state_code` vs customer state)
  2. Inserts `invoices` + `invoice_items`
  3. Calls `stockReservation.releaseReservation`
  4. Updates sales order status to `invoiced`
- **Issue** — marks invoice as `issued`, makes it eligible for payment recording
- Returns printable invoice data with HSN codes and tax breakdowns

---

#### `modules/pick-lists/`
Picking slip generation. Auto-created when a sales order is confirmed. Lists which rack/bin to pick each item from, quantity needed, and product details. Used by warehouse staff to fulfil orders.

---

#### `modules/delivery-challans/`
Delivery document (challan) for shipment. Created after picking is complete. Contains consignee address, item list, vehicle number. Used for dispatch tracking.

---

#### `modules/purchase-returns/`
Records goods returned to vendor. Each return:
1. Reduces stock via `stockHelper` (reverse GRN effect)
2. Generates a debit note against the vendor
3. Updates vendor outstanding balance

---

#### `modules/sales-returns/`
Records goods returned by customer. Each return:
1. Adds stock back via `stockHelper`
2. Generates a credit note for the customer
3. Updates customer outstanding balance

---

#### `modules/stock-adjustments/`
Manual stock corrections (e.g. found extra boxes, damaged during audit). Each adjustment:
- Requires a reason code
- Writes a ledger entry with type `adjustment`
- Updates stock summary
- Logged in audit trail

---

#### `modules/stock-counts/`
Physical cycle count management.
- **Create count sheet** — snapshot of expected quantities per product/rack
- **Enter actuals** — staff inputs physically counted quantities
- **Reconcile** — system auto-generates adjustments for variances

---

#### `modules/stock-transfers/`
Inter-warehouse stock movements. Atomic transfer:
1. Deducts from source warehouse (`stock_ledger` entry type `transfer_out`)
2. Adds to destination warehouse (`stock_ledger` entry type `transfer_in`)
3. Rolls back both on any error

---

#### `modules/damage-entries/`
Logs damaged/destroyed goods. Each entry:
- Reduces available stock via `stockHelper`
- Records damage reason, quantity, and responsible party
- Can be tied to an insurance claim reference

---

#### `modules/rack-inventory/`
Bin-level stock queries. Reports current quantity per product per rack. Used by pick list generation to identify optimal pick locations.

---

#### `modules/stock-ledger/`
Query interface for the immutable `stock_ledger` table. Supports filters by product, warehouse, date range, and movement type (grn, sale, adjustment, transfer, return, damage). Paginated for performance.

---

#### `modules/stock-summary/`
Current stock snapshot queries. Returns `qty_on_hand`, `qty_reserved`, `qty_available` per product per warehouse. Much faster than re-summing the ledger.

---

#### `modules/alerts/`
Low stock alert management.
- Alerts are auto-created by GRN posting service when `qty_available < reorder_point`
- Auto-resolved when stock is replenished above the threshold
- `GET /` lists open alerts; `PUT /:id/acknowledge` marks as seen by user

---

#### `modules/automation/`
Scheduled/automated tasks:
- **Auto rack assignment** — suggests best rack for incoming GRN items based on available capacity
- **Daily report generation** — aggregates daily KPIs and stores a snapshot

---

#### `modules/reports/`
Business analytics endpoints.

| Endpoint | Returns |
|----------|---------|
| `GET /dashboard` | KPIs: total orders, revenue, open POs, low stock count, recent activity |
| `GET /gst` | GSTR-1 style: B2B invoices, HSN summary, tax totals by period |
| `GET /revenue` | Monthly revenue trend, top 10 products, top 10 customers |
| `GET /aging` | Accounts receivable aging buckets (0-30, 31-60, 61-90, 90+ days) |
| `GET /stock-valuation` | Current stock value by product at cost price |

---

#### `modules/gst-config/`
Stores company GST details (GSTIN, company name, address, state code, PAN, bank details, fiscal year). Used by invoice generation to populate the "From" side and determine intra/inter-state tax split.

---

#### `modules/users/`
User management within a tenant.
- Admin can create/update/delete users
- Role assignment from the `roles.js` constant list
- Warehouse scope assignment (which warehouses a user can access)
- Password reset by admin (sets a temporary password)

---

#### `modules/customer-payments/`
Records payments received from customers against specific invoices. Tracks payment mode, reference number, date. Updates invoice outstanding balance. Generates receipt.

---

#### `modules/vendor-payments/`
Records payments made to vendors against purchase invoices/GRNs. Tracks payment mode, cheque number, bank, date. Updates vendor outstanding balance.

---

#### `modules/ai/`
OpenAI chatbot integration. Accepts a natural language query from the user, builds a context-aware system prompt with warehouse data, calls the OpenAI API, and returns the response. Chat history stored in `ai_chat_history` per tenant.

---

## FRONTEND

### Entry Points

#### `frontend/src/main.tsx`
Vite entry point. Renders `<App />` into the DOM, wraps it with `QueryClientProvider` (React Query) and i18next provider.

#### `frontend/src/App.tsx`
Root component. Sets up React Router routes. Wraps all protected routes with `AuthGuard` (reads from `useAuth`). Maps URL paths to page components.

#### `frontend/src/i18n.ts`
Configures i18next with browser language detection and locale JSON files. Supports English, Arabic, and more.

---

### API Layer (`frontend/src/api/`)

#### `axios.ts`
Creates the single Axios instance used by all API files. Request interceptor: auto-attaches `Authorization: Bearer <token>`. Response interceptor: on 401 `TOKEN_EXPIRED`, silently calls refresh token endpoint and retries the original request. On other 401s (invalid/expired refresh), clears localStorage and redirects to login.

#### `authApi.ts`
`login(email, password)`, `refreshToken(token)`, `logout()`, `getProfile()`, `changePassword(old, new)`

#### `productApi.ts`
`getProducts(filters)`, `createProduct(data)`, `getProduct(id)`, `updateProduct(id, data)`, `deleteProduct(id)`, `getProductShades(id)`, `createShade(productId, data)`

#### `customerApi.ts`
`getCustomers(filters)`, `createCustomer(data)`, `updateCustomer(id, data)`, `deleteCustomer(id)`, `importCustomersCsv(file)`

#### `vendorApi.ts`
Same shape as `customerApi.ts` but for vendors.

#### `grnApi.ts`
`getGRNs(filters)`, `createGRN(data)`, `getGRN(id)`, `updateQualityCheck(grnId, itemId, data)`, `postGRN(id)`

#### `salesOrderApi.ts`
`getSalesOrders(filters)`, `createSalesOrder(data)`, `confirmSalesOrder(id)`, `cancelSalesOrder(id)`, `getSalesOrder(id)`

#### `invoiceApi.ts`
`getInvoices(filters)`, `generateInvoice(salesOrderId)`, `issueInvoice(id)`, `getInvoice(id)`, `printInvoice(id)`

#### `reportApi.ts`
`getDashboardData()`, `getGSTReport(params)`, `getRevenueReport(params)`, `getAgingReport()`, `getStockValuation()`

#### `stockLedgerApi.ts`
`getStockLedger(filters)` — supports product, warehouse, date range, type filters with pagination

#### `inventoryApi.ts`
`getInventory(filters)` — current stock levels (on_hand, reserved, available) per product/warehouse

#### `stockTransferApi.ts`
`getTransfers(filters)`, `createTransfer(data)`, `getTransfer(id)`

#### `stockAdjustmentsApi.ts`
`getAdjustments(filters)`, `createAdjustment(data)`

#### `stockCountsApi.ts`
`getStockCounts(filters)`, `createStockCount(data)`, `updateCountActuals(id, items)`, `reconcileStockCount(id)`

#### `warehouseApi.ts`
`getWarehouses()`, `createWarehouse(data)`, `getWarehouse(id)`, `updateWarehouse(id, data)`, `getWarehouseRacks(id)`

#### `gstApi.ts`
`getGSTConfig()`, `saveGSTConfig(data)`

#### `damageEntriesApi.ts`
`getDamageEntries(filters)`, `createDamageEntry(data)`

#### `paymentsApi.ts`
`getPaymentsReceived(filters)`, `recordPaymentReceived(data)`, `getPaymentsMade(filters)`, `recordPaymentMade(data)`

#### `notesApi.ts`
`getCreditNotes(filters)`, `getDebitNotes(filters)`, `getCreditNote(id)`, `getDebitNote(id)`

---

### Hooks (`frontend/src/hooks/`)

#### `useAuth.tsx`
Auth context and hook. Stores `user`, `accessToken`, `refreshToken` in state + localStorage. Exports `login(email, password)`, `logout()`, `isAuthenticated`, `user`. All protected pages consume this hook to get the current user and check their role.

#### `useDashboardData.ts`
Calls `reportApi.getDashboardData()` via React Query. Returns KPI values, recent orders, low stock list, and chart data. Cached for 60 seconds.

#### `useLowStockAlerts.ts`
Polls `alertsApi.getAlerts()` every 5 minutes. Returns alert count for the notification bell badge and the full alert list for the Alerts page.

#### `useNextDocNumber.ts`
Fetches the next document number for a given type (PO, SO, GRN, etc.) from the backend. Used to pre-fill document number fields in creation forms.

#### `usePaginatedApi.ts`
Generic hook wrapping React Query for list endpoints. Manages `page`, `limit`, `sortBy`, `sortOrder`, and `filters` state. Returns `data`, `total`, `isLoading`, `setPage`, `setFilters` — so every list page uses identical pagination logic.

#### `use-toast.ts`
Thin wrapper around Sonner's toast API. Exports `toast.success(msg)`, `toast.error(msg)`, `toast.info(msg)`.

#### `use-mobile.tsx`
Returns `isMobile: boolean` based on a `768px` media query breakpoint. Used to conditionally render mobile-friendly layouts.

---

### Types (`frontend/src/types/`)

| File | What it defines |
|------|----------------|
| `auth.types.ts` | `LoginDto`, `AuthUser`, `UserRole` enum |
| `product.types.ts` | `Product`, `Shade`, `Batch`, `ProductCategory` |
| `grn.types.ts` | `GRN`, `GRNItem`, `QualityCheckResult` |
| `salesOrder.types.ts` | `SalesOrder`, `SalesOrderItem`, `SalesOrderStatus` |
| `invoice.types.ts` | `Invoice`, `InvoiceItem`, `TaxBreakdown` |
| `stock.types.ts` | `StockLedgerEntry`, `StockSummary`, `StockReservation` |
| `warehouse.types.ts` | `Warehouse`, `Rack`, `RackInventory` |
| `vendor.types.ts` | `Vendor` |
| `customer.types.ts` | `Customer` |
| `api.types.ts` | `ApiResponse<T>`, `PaginatedResponse<T>`, `ApiError` |
| `misc.types.ts` | `DamageEntry`, `StockAdjustment`, `Alert`, `Payment` |
| `index.ts` | Re-exports all types |

---

### Layout Components (`frontend/src/components/layout/`)

#### `DashboardLayout.tsx`
Main app shell. Renders `AppSidebar` on the left and a content area with `TopBar` at the top. All authenticated pages are children of this component.

#### `AppSidebar.tsx`
Left navigation sidebar. Groups navigation links by section (Dashboard, Master Data, Purchasing, Sales, Warehouse Ops, Reports, Settings). Highlights the active route. Collapses to icon-only mode on narrow screens.

#### `TopBar.tsx`
Top header bar. Shows current page title, `NotificationsBell`, `LanguageSwitcher`, and a user avatar dropdown (profile, logout).

#### `NotificationsBell.tsx`
Bell icon with a badge showing unread low-stock alert count (from `useLowStockAlerts`). Clicking opens a dropdown list of recent alerts with severity color coding.

#### `LanguageSwitcher.tsx`
Dropdown to switch UI language. Calls `i18n.changeLanguage(code)` on selection. Supports English, Arabic (RTL), etc.

---

### Shared Components (`frontend/src/components/shared/`)

#### `DataTableShell.tsx`
Reusable table component used by every list page. Accepts `columns` definition, `data` array, `isLoading`, and pagination props. Handles loading skeleton, empty state, and page size selector.

#### `CrudFormDialog.tsx`
Generic modal dialog wrapping React Hook Form. Used for simple create/edit forms. Accepts a `schema` (Zod), `fields` config, `onSubmit` callback, and `defaultValues`.

#### `DeleteConfirmDialog.tsx`
Confirmation modal shown before any delete action. Displays the entity name and a destructive "Delete" button. Prevents accidental deletions.

#### `PageHeader.tsx`
Consistent page title area with breadcrumbs and an optional primary action button (e.g. "Create Purchase Order").

#### `KPICard.tsx`
Dashboard metric card. Shows label, value, optional trend arrow (up/down), and percentage change. Colour-coded by trend direction.

#### `LineItemsEditor.tsx`
Dynamic line items table used in PO, GRN, and SO forms. Supports add/remove rows, product autocomplete, quantity input, price input, and auto-calculated line totals.

#### `OrderFormDialog.tsx`
Full-page-style modal for creating sales orders and purchase orders. Embeds `LineItemsEditor`, vendor/customer selector, and document date picker.

#### `POCreateEditDialog.tsx`
Specific modal for Purchase Order create/edit. Includes vendor selection, expected delivery date, and remarks.

#### `CsvImportDialog.tsx`
CSV file upload modal. Shows expected column format, validates the file before upload, and displays import results (rows imported, rows failed with reasons).

#### `StatusBadge.tsx`
Colour-coded badge for entity status values (e.g. `draft` = grey, `confirmed` = blue, `invoiced` = green, `cancelled` = red).

#### `NavLink.tsx`
Styled `<Link>` component that applies active styles when the current route matches.

---

### Feature Components (`frontend/src/components/features/`)

#### `AIChatbot.tsx`
Floating chat window powered by the backend `/api/ai` endpoint. Maintains message history in local state. Sends user messages to the backend and streams back OpenAI responses. Shows a typing indicator during loading.

#### `StockTransferViewModal.tsx`
Read-only modal showing the full details of a stock transfer (source warehouse, destination, items, quantities, timestamp, status).

---

### Pages (`frontend/src/pages/`)

#### `AuthPage.tsx`
Login form. Calls `useAuth().login()`. On success redirects to `/dashboard`. Handles invalid credentials and rate-limit errors.

#### `DashboardPage.tsx`
Main dashboard. Uses `useDashboardData` to show:
- KPI cards (total orders today, revenue this month, open POs, low stock count)
- Recent sales orders table
- Low stock alerts list
- Revenue bar chart (Recharts)
- Top products pie chart (Recharts)

#### `ProductsPage.tsx`
Product master list using `DataTableShell`. Supports search, category filter. Opens `CrudFormDialog` for create/edit. Calls `deleteProduct` with `DeleteConfirmDialog`.

#### `ProductDetailsPage.tsx`
Product details with tabs: Info, Shades/Batches, Stock Summary across warehouses, Stock Ledger history.

#### `CategoriesPage.tsx`
Category list with inline create/edit via `CrudFormDialog`.

#### `VendorsPage.tsx`
Vendor list with create/edit dialog, CSV import via `CsvImportDialog`, and outstanding balance display.

#### `CustomersPage.tsx`
Same pattern as `VendorsPage` but for customers.

#### `WarehousesPage.tsx`
Warehouse list. Shows total capacity and used capacity per warehouse. Links to `WarehouseDetailPage`.

#### `WarehouseDetailPage.tsx`
Warehouse detail with tabs: Info, Racks (list of racks with capacity), and Stock Summary for that warehouse.

#### `RacksPage.tsx`
Rack management within a warehouse context. Create/edit racks with aisle, row, column, capacity fields.

#### `PurchaseOrdersPage.tsx`
PO list with status filter and `POCreateEditDialog` for creation. Status badges via `StatusBadge`.

#### `PurchaseOrderDetailsPage.tsx`
PO detail view. Shows header info, line items table, and linked GRNs. "Receive" button opens GRN creation pre-linked to this PO.

#### `GRNPage.tsx`
GRN list with status filter.

#### `GRNDetailPage.tsx`
GRN detail. Two workflows:
1. **Quality Check** — item-by-item pass/fail form with qty fields
2. **Post to Stock** — "Post GRN" button triggers the atomic stock update

#### `SalesOrdersPage.tsx`
Sales order list. "Create Order" opens `OrderFormDialog` with customer selector and `LineItemsEditor`. Confirm/cancel actions per row.

#### `InvoicesPage.tsx`
Invoice list. "Generate" button for confirmed SOs. "Print" opens a printable invoice view.

#### `PickListsPage.tsx`
Auto-generated pick lists for confirmed orders. Shows rack locations and quantities to pick. "Mark Picked" button updates status.

#### `DeliveryChallansPage.tsx`
Delivery challan list. Create challan from packed sales orders with vehicle and consignee details.

#### `StockCountsPage.tsx`
Stock count management. Create count sessions, enter actual quantities, reconcile variances.

#### `StockTransfersPage.tsx`
Inter-warehouse transfer list and creation form. Source/destination warehouse selectors, product and quantity input.

#### `StockAdjustmentsPage.tsx`
Stock adjustment list and creation. Requires reason code selection.

#### `DamageEntriesPage.tsx`
Damage entry list and creation. Product, warehouse, quantity, damage reason, date.

#### `SalesReturnsPage.tsx`
Sales return list and creation from existing invoices. Auto-generates credit notes.

#### `PurchaseReturnsPage.tsx`
Purchase return list and creation against GRNs. Auto-generates debit notes.

#### `AlertsPage.tsx`
Full list of low stock alerts with severity, product name, current qty, reorder point, and acknowledge action.

#### `PaymentsReceivedPage.tsx`
Customer payment records. Create payment entries against open invoices. Running outstanding balance display.

#### `PaymentsMadePage.tsx`
Vendor payment records. Same structure as `PaymentsReceivedPage` for vendor side.

#### `CreditNotesPage.tsx`
Credit note list (auto-generated by sales returns). View detail with line items and tax breakdown.

#### `DebitNotesPage.tsx`
Debit note list (auto-generated by purchase returns). Same structure as `CreditNotesPage`.

#### `GSTReportPage.tsx`
GST report with date range filter. Shows:
- B2B invoice summary (GSTIN-wise)
- HSN code summary with taxable value, CGST, SGST, IGST
- Export to CSV/Excel

#### `RevenueReportPage.tsx`
Revenue analytics with date range filter:
- Monthly revenue bar chart
- Top 10 products by revenue
- Top 10 customers by revenue

#### `AgingReportPage.tsx`
Accounts receivable aging: lists customers with overdue balances split into 0-30, 31-60, 61-90, 90+ day buckets.

#### `StockLedgerPage.tsx`
Stock ledger viewer with filters (product, warehouse, date range, movement type). Paginated table of every stock movement.

#### `InventoryStockPage.tsx`
Current inventory snapshot table. Shows on-hand, reserved, available quantities per product per warehouse. Export to CSV.

#### `UsersPage.tsx`
User management (admin only). Create/edit users with role and warehouse scope assignment.

#### `SettingsPage.tsx`
Application settings including GST configuration form and display preferences.

---

### UI Components (`frontend/src/components/ui/`)

60+ primitive components from **shadcn/ui** (built on Radix UI). These are unstyled-accessible primitives styled with Tailwind. Key ones:

| Component | Purpose |
|-----------|---------|
| `button.tsx` | Button with variants (default, destructive, outline, ghost, link) |
| `input.tsx` | Styled text input |
| `dialog.tsx` | Modal dialog with overlay |
| `select.tsx` | Dropdown select |
| `table.tsx` | Table primitives (Table, Thead, Tbody, Tr, Td) |
| `form.tsx` | React Hook Form integration with label + error display |
| `tabs.tsx` | Tab switcher |
| `badge.tsx` | Inline colour badge |
| `card.tsx` | Card container |
| `toast.tsx` / `toaster.tsx` | Toast notification system |
| `sonner.tsx` | Sonner toast integration |
| `calendar.tsx` | Date picker calendar |
| `pagination.tsx` | Page navigation controls |
| `skeleton.tsx` | Loading placeholder shimmer |
| `sidebar.tsx` | Collapsible sidebar primitives |
| `dropdown-menu.tsx` | Context/action menus |
| `command.tsx` | Command palette / combobox search |
| `scroll-area.tsx` | Custom scrollbar container |
| `separator.tsx` | Horizontal/vertical divider |
| `tooltip.tsx` | Hover tooltip |
| `popover.tsx` | Floating popover panel |
| `checkbox.tsx` | Accessible checkbox |
| `switch.tsx` | Toggle switch |
| `progress.tsx` | Progress bar |
| `alert.tsx` | Inline alert message |
| `breadcrumb.tsx` | Breadcrumb navigation |
| `accordion.tsx` | Expandable section |
| `drawer.tsx` | Slide-in panel (mobile-friendly alternative to dialog) |
| `resizable.tsx` | Resizable panel layout |

---

## Data Flow: Key Workflows

### Inbound (Purchase → Stock)
```
Vendor → Purchase Order → GRN (quality check) → Post GRN → Stock Ledger + Stock Summary updated → Low Stock Alert resolved (if applicable)
```

### Outbound (Sale → Dispatch)
```
Customer → Sales Order (draft) → Confirm (stock reserved) → Pick List generated → Delivery Challan → Invoice generated → Payment recorded
```

### Stock Accuracy
```
Stock Ledger (append-only truth) ← every movement
Stock Summary (running snapshot) ← updated per movement
Stock Reservations (locked qty) ← per confirmed sales order
```

### GST Invoicing
```
Invoice generated from Sales Order → GST config state_code vs customer state_code →
  Same state? → CGST + SGST (split 50/50)
  Different state? → IGST (full rate)
→ Invoice issued → Payment received → Outstanding cleared
```

---

## Multi-Tenancy Model

Every DB table has a `tenant_id` column. The `auth.middleware` extracts `tenant_id` from the JWT and attaches it to `req`. Every repository query appends `AND tenant_id = ?`. One database, complete data isolation per tenant.

---

## Role Permissions Quick Reference

| Role | Can Do |
|------|--------|
| `super_admin` | Everything across all tenants |
| `admin` | Everything within their tenant |
| `warehouse_manager` | Full warehouse ops for assigned warehouses |
| `supervisor` | GRN, stock counts, adjustments, transfers |
| `sales` | Sales orders, customers, invoices |
| `accountant` | Invoices, payments, reports, GST |
| `warehouse_staff` | Pick lists, delivery challans, stock counts |
| `viewer` | Read-only access to all data |
| `user` | Limited read access |
