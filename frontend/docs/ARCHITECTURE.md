# Tiles WMS — Enterprise Architecture

Multi-tenant SaaS Warehouse Management System. Database: **tiles_wms** (MySQL).  
**Rules:** No table/column renames; use existing schema only; production-grade layers.

---

## Phase 1: Backend Architecture

### 1.1 Modular Folder Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── env.js              # Environment-based config (db, jwt, tenant, security)
│   │   ├── db.js               # MySQL pool, query(), beginTransaction()
│   │   └── seed.js             # Seed runner config
│   ├── constants/
│   │   └── roles.js            # ROLES, ROLE_HIERARCHY, PERMISSIONS matrix
│   ├── middlewares/
│   │   ├── auth.middleware.js   # JWT verify → req.user, req.tenantId
│   │   ├── tenant.middleware.js # resolveTenant, ensureTenant (jwt/header/subdomain)
│   │   ├── role.middleware.js  # requireRole, requireMinRole, requireSelfOrAdmin
│   │   ├── permission.middleware.js  # requirePermission (route → PERMISSIONS)
│   │   ├── error.middleware.js # Central errorHandler, AppError, notFoundHandler
│   │   ├── rateLimiter.middleware.js
│   │   └── upload.middleware.js
│   ├── modules/
│   │   ├── auth/               # login, refresh, profile
│   │   │   ├── routes.js
│   │   │   ├── controller.js
│   │   │   ├── service.js
│   │   │   ├── repository.js
│   │   │   └── validation.js
│   │   ├── warehouses/         # Controller → Service → (no repo; service does DB)
│   │   ├── vendors/
│   │   ├── customers/
│   │   ├── products/           # controller, service, repository, validation, routes
│   │   ├── categories/
│   │   ├── racks/
│   │   ├── grn/                # Transaction-safe: create draft, post → stock
│   │   │   ├── routes.js
│   │   │   ├── controller.js
│   │   │   ├── service.js      # beginTransaction, repo, postStockMovement, rollback
│   │   │   └── repository.js
│   │   ├── stock-ledger/       # Read-only list (no create/update/delete)
│   │   ├── stock-summary/      # Read-only
│   │   ├── stock-transfers/    # CRUD + executeTransfer (transaction)
│   │   ├── sales-orders/      # create (tx), confirm (tx)
│   │   ├── invoices/
│   │   └── reports/
│   ├── utils/
│   │   ├── response.js         # success, created, paginated, error
│   │   ├── pagination.js       # parsePagination, buildSearchClause
│   │   ├── logger.js
│   │   ├── docNumber.js       # generateDocNumber(tenantId, type, prefix)
│   │   ├── stockHelper.js     # postStockMovement(trx, opts) — only way to change stock
│   │   └── auditLog.js
│   └── app.js                 # Express app, routes, error handlers
├── database/
│   ├── schema.sql
│   └── seed/
└── package.json
```

### 1.2 Layer Responsibilities

| Layer        | Responsibility |
|-------------|----------------|
| **Routes**  | HTTP mapping; apply authenticate, role/permission; call controller. |
| **Controller** | Parse req (tenantId, user, params, body); validate input; call service; format response. |
| **Service** | Business logic; transactions; orchestrate repository + stockHelper; no raw SQL in controller. |
| **Repository** | Parameterized SQL; all queries include `tenant_id = ?`; used by service. |
| **Validation** | Joi (or similar) schemas for body/query; used in controller or middleware. |
| **Middleware** | Auth (JWT → user, tenantId), tenant resolution, role/permission, error handling. |

### 1.3 Centralized Error Handling

- **errorHandler** (last): Handles Joi, `ER_DUP_ENTRY`, FK errors, **AppError** (statusCode + code), generic 500.
- **notFoundHandler**: 404 for unknown routes.
- **AppError**: `throw new AppError('Message', 404, 'NOT_FOUND')` for business errors.

### 1.4 Environment-Based Config

- **config/env.js**: `db` (host, port, user, password, database: tiles_wms, pool limits), `jwt` (secret, expiresIn), `tenant.resolution` (jwt | header | subdomain), `security` (cors, rate limit). Production requires `JWT_SECRET` / `JWT_REFRESH_SECRET`.

---

## Phase 2: Multi-Tenant Isolation

### 2.1 Rules

- Every table has **tenant_id**.
- **All** SELECT/INSERT/UPDATE/DELETE must include `tenant_id = ?` (from context, never from body).
- No API or query may return or modify another tenant’s data.

### 2.2 Tenant Context from JWT (Middleware)

```javascript
// auth.middleware.js (existing)
// 1. Extract Bearer token
// 2. jwt.verify(token, secret)
// 3. req.user = { id: decoded.sub, tenantId: decoded.tenantId, role, email, name }
// 4. req.tenantId = decoded.tenantId   // ALWAYS from JWT, never from body/query
```

### 2.3 Repository / Service Pattern

- **Service** receives `tenantId` from controller (`req.tenantId`).
- **Repository** receives `tenantId` and uses it in every query:

```javascript
// Example: repo.findAll(tenantId, queryParams)
const conditions = ['tenant_id = ?'];
const params = [tenantId];
// ... then WHERE conditions.join(' AND ')
```

### 2.4 Optional Tenant Strategies (tenant.middleware.js)

- **jwt** (default): tenantId from JWT only.
- **header**: validate `X-Tenant-ID` for server-to-server.
- **subdomain**: resolve tenant from host; tenantId set in auth after lookup.

---

## Phase 3: Role-Based Authorization

### 3.1 Roles (constants/roles.js)

- **super_admin**, **admin**, **warehouse_manager**, **sales**, **accountant**, **user**
- **ROLE_HIERARCHY**: user &lt; sales &lt; accountant &lt; warehouse_manager &lt; admin &lt; super_admin
- **PERMISSIONS**: route key (e.g. `POST /grn`) → array of allowed roles

### 3.2 Middleware

- **requireRole(['admin', 'warehouse_manager'])** — user must have one of these (or super_admin).
- **requireMinRole('warehouse_manager')** — user’s hierarchy index ≥ minimum.
- **requireSelfOrAdmin** — access only if `req.params.id === req.user.id` or admin+.
- **requirePermission(req)** — derive `METHOD + path` from route, check `PERMISSIONS`; 403 if not allowed.

### 3.3 Route Protection

- All data routes: `authenticate` (then optionally `resolveTenant`, `ensureTenant`).
- Write routes: add `requireMinRole('warehouse_manager')` or equivalent for GRN, PO, etc.
- Reports: `requireMinRole('accountant')` or as per PERMISSIONS.

---

## Phase 4: Transaction-Safe Business Modules

### 4.1 Principles

- **Stock is never directly edited.** Updates only via **postStockMovement(trx, opts)** inside a transaction.
- **Ledger entries are immutable** (no DELETE/UPDATE on stock_ledger).
- **Transactions**: `beginTransaction()` → business steps → `commit()`; on failure `rollback()` then `release()`.

### 4.2 GRN (Goods Receipt Note)

- **Create**: Transaction → insert `grn` → insert `grn_items` → commit. No stock change.
- **Post**: Transaction → for each item call **postStockMovement(trx, { transactionType: 'grn', boxesIn, ... })** → update GRN status → update PO received if linked → commit. Rollback on any failure.

### 4.3 Sales Order

- **Create**: Transaction → insert `sales_orders` → insert `sales_order_items` → commit.
- **Confirm**: Transaction → update SO status → create pick_list + pick_list_items → commit.
- **Dispatch (when implemented)**: Transaction → for each item **postStockMovement(trx, { transactionType: 'sale', boxesOut, ... })** → update SO/pick status → commit.

### 4.4 Transfers

- **Create**: Insert `stock_transfers` + `stock_transfer_items` (draft); no stock change.
- **Execute (dispatch)**: Transaction → for each item: **TRANSFER_OUT** from source warehouse via postStockMovement → **TRANSFER_IN** to destination warehouse → update transfer status → commit.
- **Receive**: Optional step to mark received_boxes; no double stock move.

### 4.5 Stock Adjustments

- Transaction → **postStockMovement(trx, { transactionType: 'adjustment', boxesIn/boxesOut })** → commit. No direct UPDATE on stock_summary.

### 4.6 Ledger & Summary

- **stock_ledger**: Read-only API (list with filters, pagination). No POST/PUT/DELETE.
- **stock_summary**: Read-only; updated only by postStockMovement.

---

## Phase 5: API Design

### 5.1 Per-Module Conventions

- **GET /resource** — Paginated list: `?page=1&limit=25&search=&sortBy=created_at&sortOrder=DESC`. Response: `{ success, message, data: [], meta: { page, limit, total, totalPages } }`.
- **GET /resource/:id** — Single: `{ success, message, data: {} }`.
- **POST /resource** — Create: 201, `{ success, message, data }`. Body validated; tenantId from JWT.
- **PUT /resource/:id** — Update: 200, validated body; no tenant_id in body.
- **DELETE /resource/:id** — Soft delete if `is_active` exists, else hard delete; 204.

### 5.2 Status Codes & Errors

- 200 OK, 201 Created, 204 No Content
- 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Validation Error, 500 Internal

Error body: `{ success: false, error: { code, message } }`.

### 5.3 Safety

- All DB queries **parameterized** (no string concatenation of user input).
- No mass assignment: only allowlisted fields in service/repository.

---

## Phase 6: Frontend (React)

### 6.1 Structure

```
frontend/src/
├── api/                    # One file per domain (axios-based)
│   ├── axios.ts            # Centralized instance (baseURL, interceptors: token, refresh, error)
│   ├── authApi.ts
│   ├── vendorApi.ts
│   ├── customerApi.ts
│   ├── warehouseApi.ts
│   ├── grnApi.ts
│   ├── stockTransferApi.ts
│   ├── reportApi.ts        # dashboard, stock ledger, reports
│   └── miscApi.ts          # purchaseOrder, pickList, payments, etc.
├── components/
│   ├── layout/             # AppSidebar, DashboardLayout, TopBar
│   ├── shared/             # PageHeader, DataTableShell, CrudFormDialog, DeleteConfirmDialog, StatusBadge, OrderFormDialog
│   ├── ui/                 # Design system (Button, Input, Dialog, Table, Skeleton, etc.)
│   └── features/           # Auth (LoginPage), domain-specific forms if any
├── hooks/
│   ├── useAuth.tsx         # Auth context, user, login, signOut
│   ├── useDashboardData.ts
│   └── usePaginatedApi.ts
├── pages/                  # One page per module (no generic CRUD generator)
│   ├── DashboardPage.tsx
│   ├── VendorsPage.tsx
│   ├── CustomersPage.tsx
│   ├── WarehousesPage.tsx
│   ├── RacksPage.tsx
│   ├── ProductsPage.tsx
│   ├── CategoriesPage.tsx
│   ├── GRNPage.tsx
│   ├── StockTransfersPage.tsx
│   ├── StockLedgerPage.tsx
│   ├── PurchaseOrdersPage.tsx
│   ├── SalesOrdersPage.tsx
│   ├── InvoicesPage.tsx
│   └── ...
├── types/                  # TypeScript interfaces (vendor, customer, warehouse, stock, grn, api)
├── lib/
│   ├── api.ts              # Axios instance (VITE_API_BASE_URL)
│   └── utils.ts
└── App.tsx                 # Routes, QueryClient, AuthProvider
```

- **Module-based pages**: one page per module; business flow forms (GRN with items, SO with items, Transfer with items).
- **API layer**: Centralized axios instance (baseURL from env); interceptors for token, refresh, error toasts.
- **Business flow forms**: Create GRN (header + line items), Create SO, Create Transfer with items; confirm/post actions with confirmation dialogs.

### 6.2 Conventions

- Loading states (skeletons/spinners), error states (message + retry).
- Role-based UI: hide/disable actions based on user role (e.g. Post GRN only for warehouse_manager+).
- Confirmation dialogs for: Post GRN, Confirm SO, Execute Transfer, Delete.
- Environment-based API URL (e.g. `VITE_API_BASE_URL`).

---

## Phase 7: Safety Rules

- **No hard delete on stock_ledger** — ledger is append-only.
- **No direct stock editing** — stock changes only via postStockMovement in a transaction.
- **No cross-tenant queries** — always filter by `req.tenantId`.
- **No unprotected routes** — all data routes behind authenticate (and role where needed).
- **All DB queries parameterized** — use `?` placeholders and params array.

---

## Phase 8: Performance & Scale

### 8.1 Indexing (existing schema)

- Composite indexes on (tenant_id, entity_id, date) for ledger, summary, invoices, payments.
- Foreign key columns indexed (e.g. grn_id, sales_order_id) for joins.

### 8.2 Query Optimization

- Use pagination (limit/offset or cursor) on all list APIs.
- Avoid N+1: prefer JOINs or batch loads for related data (e.g. GRN with items in one getById).
- Aggregations (dashboard, reports) use single queries with COUNT/SUM/GROUP BY.

### 8.3 Caching

- Consider Redis for: session/refresh token blacklist, per-tenant config, or report caches with TTL.
- Cache invalidation on write (e.g. stock summary by warehouse/product).

### 8.4 Audit Logs

- **audit_logs** table: tenant_id, user_id, action, table_name, record_id, old_values, new_values, ip, user_agent.
- Write on create/update/delete (and critical actions like Post GRN) from controller or service.

### 8.5 Background Jobs

- Use a queue (e.g. Bull with Redis) for: email notifications, report generation, sync to external systems.
- Keep transaction scope small; push “after-commit” work to the queue.

---

## Sample Code References

| Concern | File | Description |
|--------|------|-------------|
| **Tenant from JWT** | `src/middlewares/auth.middleware.js` | Sets `req.user`, `req.tenantId` from JWT only; never from body. |
| **Role middleware** | `src/middlewares/role.middleware.js` | requireRole([]), requireMinRole('warehouse_manager'), requireSelfOrAdmin. |
| **Permission middleware** | `src/middlewares/permission.middleware.js` | requirePermission('POST /grn') — checks PERMISSIONS matrix. |
| **GRN transaction** | `src/modules/grn/service.js` | create (tx: insert grn + items); postGRN (tx: postStockMovement per item → update status). |
| **Sales transaction** | `src/modules/sales-orders/service.js` | create (tx: insert SO + items); confirmOrder (tx: update SO, create pick_list + items). |
| **Stock movement** | `src/utils/stockHelper.js` | postStockMovement(trx, opts) — only way to change stock; updates summary + ledger. |
| **Transfer execution** | `src/modules/stock-transfers/transferExecution.service.js` | executeTransfer(id, tenantId, userId): tx → TRANSFER_OUT per item → TRANSFER_IN → status in_transit. |
| **Transfer execute route** | `src/modules/stock-transfers/transfer.routes.js` | POST /:id/execute with requireMinRole('warehouse_manager'). |

---

## Sample Code Snippets

### Tenant injection (auth.middleware.js)

```javascript
const token = authHeader.split(' ')[1];
const decoded = jwt.verify(token, env.jwt.secret);
req.user = { id: decoded.sub, tenantId: decoded.tenantId, role: decoded.role, email: decoded.email, name: decoded.name };
req.tenantId = decoded.tenantId;  // ALWAYS from JWT, never from body
next();
```

### Role middleware (role.middleware.js)

```javascript
const requireMinRole = (minRole) => {
  const minIndex = ROLE_HIERARCHY.indexOf(minRole);
  return (req, res, next) => {
    if (!req.user) return error(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    if (ROLE_HIERARCHY.indexOf(req.user.role) < minIndex) return error(res, 'Insufficient permissions', 403, 'FORBIDDEN');
    next();
  };
};
// Usage: router.post('/:id/post', authenticate, requireMinRole('warehouse_manager'), ctrl.postGRN);
```

### GRN post (transaction + stock movement)

```javascript
const postGRN = async (id, tenantId, userId) => {
  const grn = await getById(id, tenantId);
  if (grn.status !== 'draft' && grn.status !== 'verified') throw new AppError('Invalid status', 400, 'INVALID_STATUS');
  const trx = await beginTransaction();
  try {
    for (const item of grn.items) {
      const netBoxes = parseFloat(item.received_boxes) - parseFloat(item.damaged_boxes || 0);
      if (netBoxes > 0) {
        await postStockMovement(trx, {
          tenantId, warehouseId: grn.warehouse_id, productId: item.product_id,
          transactionType: 'grn', referenceId: id, referenceType: 'grn',
          boxesIn: netBoxes, piecesIn: parseFloat(item.received_pieces || 0),
          sqftPerBox: parseFloat(item.sqft_per_box || 0), notes: `GRN Posted: ${grn.grn_number}`, createdBy: userId,
        });
      }
    }
    await repo.updateStatus(trx, id, tenantId, 'posted');
    await trx.commit();
    return getById(id, tenantId);
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};
```

### Transfer execution (transaction: OUT then IN)

```javascript
// transferExecution.service.js — executeTransfer(transferId, tenantId, userId)
const trx = await beginTransaction();
try {
  for (const item of items) {
    // 1) Check source stock (FOR UPDATE)
    const [sourceSummary] = await trx.query(`SELECT total_boxes, avg_cost_per_box FROM stock_summary WHERE ... FOR UPDATE`);
    if (!sourceSummary || parseFloat(sourceSummary.total_boxes) < boxes) {
      await trx.rollback();
      trx.release();
      throw new AppError('Insufficient stock', 400, 'INSUFFICIENT_STOCK');
    }
    // 2) TRANSFER_OUT at source
    await postStockMovement(trx, { tenantId, warehouseId: fromWh, productId, transactionType: 'transfer_out', boxesOut: boxes, ... });
    // 3) TRANSFER_IN at destination (unitPrice from source avg cost)
    await postStockMovement(trx, { tenantId, warehouseId: toWh, productId, transactionType: 'transfer_in', boxesIn: boxes, unitPrice: sourceSummary.avg_cost_per_box, ... });
  }
  await trx.query(`UPDATE stock_transfers SET status = 'in_transit' WHERE id = ? AND tenant_id = ?`, [transferId, tenantId]);
  await trx.commit();
} catch (err) {
  await trx.rollback();
  throw err;
} finally {
  trx.release();
}
