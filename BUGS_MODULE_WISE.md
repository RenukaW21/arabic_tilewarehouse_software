# Open Bugs — Module-Wise

**Generated:** 2026-06-02
**Scope:** Re-audit of new modules (production, marketplace, loyalty, approval-requests) + existing codebase
**Total Open:** 30 bugs (24 backend · 16 frontend — includes 2 shared bug entries for BUG-F09)

---

## Open Bugs by Module

| Module | Critical | High | Medium | Low | Total |
|--------|----------|------|--------|-----|-------|
| [app.js — Core Config](#appjs--core-config) | — | 3 | — | 1 | **4** |
| [approval-requests](#approval-requests) | 1 | — | — | — | **1** |
| [loyalty](#loyalty) | — | 3 | 2 | — | **5** |
| [marketplace-credentials](#marketplace-credentials) | — | — | — | 1 | **1** |
| [marketplace-orders](#marketplace-orders) | — | 1 | — | — | **1** |
| [marketplace-pricing](#marketplace-pricing) | — | 1 | 1 | — | **2** |
| [marketplace-returns](#marketplace-returns) | — | 1 | — | — | **1** |
| [marketplace-sync](#marketplace-sync) | — | 1 | — | 1 | **2** |
| [production-batches](#production-batches) | 1 | 1 | — | 1 | **3** |
| [production-orders](#production-orders) | 1 | 1 | 1 | — | **3** |
| [Frontend — ApprovalRequestsPage](#frontend--approvalrequestspage) | — | 1 | — | — | **1** |
| [Frontend — LoyaltyPage](#frontend--loyaltypage) | — | 3 | 1 | — | **4** |
| [Frontend — marketplace/\*](#frontend--marketplace-pages) | — | 1 | 3 | — | **4** |
| [Frontend — production/\*](#frontend--production-pages) | — | 2 | 1 | 2 | **5** |
| [Frontend — hooks/usePaginatedApi](#frontend--hooksusepagiatedapi) | — | — | 2 | — | **2** |

---

---

## BACKEND — OPEN BUGS

---

### app.js / Core Config

> `src/app.js`

---

#### BUG-N16 — CORS allows ALL origins
- **Severity:** 🔶 High
- **Line:** 153–157
- **Problem:** Origin callback is `(_, cb) => cb(null, true)` — always returns `true`. Any domain can make credentialed cross-origin requests to the API.
- **Impact:** Malicious pages on any domain can issue authenticated API calls on behalf of logged-in users (CSRF vector).
- **Fix:** Replace with an env-configured allowlist: `const allowed = process.env.ALLOWED_ORIGINS.split(','); origin: (o, cb) => cb(null, allowed.includes(o))`.

---

#### BUG-N17 — `buildCrudRouter` has no role guards on write operations
- **Severity:** 🔶 High
- **Lines:** 61–141
- **Problem:** Generic `buildCrudRouter` creates POST/PUT/DELETE routes with only `authenticate` — no `requireRole` or `requireMinRole`. Used for `shades`, `batches`, `credit_notes`, `debit_notes`, `notifications`, `audit_logs`. Any `viewer`-role user can create or delete these records including audit logs.
- **Impact:** Low-privilege users can tamper with audit logs, credit notes, debit notes, shades.
- **Fix:** Add `requireMinRole('admin')` (or role appropriate per resource) to POST/PUT/DELETE in `buildCrudRouter`.

---

#### BUG-N15 — Rate limiter commented out — all endpoints unprotected
- **Severity:** 🔶 High
- **Line:** 171
- **Problem:** `// app.use(`${API}/`, apiLimiter);` is commented out. Any client can send unlimited requests to any endpoint including `/auth/login`.
- **Impact:** No protection against brute-force, denial-of-service, or credential stuffing attacks.
- **Fix:** Uncomment the line; verify `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` are set in env config.

---

#### BUG-N18 — `/alerts` route registered twice — second is dead code
- **Severity:** 🔵 Low
- **Lines:** 212, 230
- **Problem:** Line 212 registers `alertsRoutes`; line 230 also registers `buildCrudRouter('low_stock_alerts', ...)` on the same path. Express uses the first match; the second registration is unreachable. If the order were ever swapped, the unguarded generic router would serve all alert endpoints.
- **Impact:** Dead code; silent security risk if registration order changes.
- **Fix:** Remove the duplicate `buildCrudRouter` registration for `/alerts`.

---

### approval-requests

> `src/modules/approval-requests/service.js`

---

#### BUG-N03 — `approve()` fires stock action BEFORE marking request approved — double deduction on retry
- **Severity:** 🔴 Critical
- **Lines:** 64–92
- **Problem:** `adjService.approve(row.reference_id, ...)` (stock movement) is called before `repo.setApproved(id, ...)`. The two calls share NO transaction. If the stock write succeeds but `setApproved` fails (DB timeout, connection drop), the approval_request row stays `pending`. A second admin click re-applies the stock movement.
- **Impact:** Double stock deduction or double stock credit when the approve endpoint is retried after a partial failure.
- **Fix:** Wrap both `adjService.approve` and `repo.setApproved` inside a single database transaction; roll back on any failure.

---

### loyalty

> `src/modules/loyalty/controller.js`, `service.js`, `routes.js`

---

#### BUG-N06 — All controller handlers missing try/catch — server crash on any service error
- **Severity:** 🔶 High
- **Lines:** controller.js 6–55
- **Problem:** Every handler (`getOverview`, `getSettings`, `updateSettings`, `getCustomers`, `getTransactions`, `createTransaction`, `getPromotions`, `createPromotion`, `updatePromotion`, `getReferrals`, `createReferral`, `completeReferral`) calls `await service.*` with no try/catch or `next(err)`. If `express-async-errors` patch ever fails to apply, any service error becomes an unhandled rejection that crashes Node.js.
- **Impact:** Server crash on any service-layer error in all loyalty endpoints.
- **Fix:** Wrap every handler body in try/catch with `next(err)`, or apply an `asyncHandler` wrapper consistent with the rest of the codebase.

---

#### BUG-N07 — Balance check runs outside transaction — TOCTOU race
- **Severity:** 🔶 High
- **Lines:** service.js 105–119
- **Problem:** `getBalance` falls back to `const executor = trx ?? { query }` when `trx` is undefined. The fallback `{ query }` runs outside any transaction. Two concurrent requests can both read a positive balance, both pass the check, and both debit — pushing the balance below zero.
- **Impact:** Loyalty point balance can go negative under concurrent requests.
- **Fix:** Ensure `getBalance` always uses `SELECT ... FOR UPDATE` inside the active transaction; remove or guard the non-transactional fallback path.

---

#### BUG-N08 — `completeReferral` not atomic — double point award on retry
- **Severity:** 🔶 High
- **Lines:** service.js 441–462
- **Problem:** `addTransaction(...)` and `UPDATE loyalty_referrals SET status='rewarded'` are called sequentially without a wrapping transaction. If the point debit succeeds but the status UPDATE fails, the referral stays `pending`. A retry awards points a second time since the `status === 'rewarded'` guard still passes.
- **Impact:** Double point award on retry after any partial DB failure.
- **Fix:** Wrap both `addTransaction` and the status UPDATE in a single database transaction.

---

#### BUG-N09 — Promotion create/update routes have no Joi validation
- **Severity:** 🔶 High
- **File:** routes.js — POST `/promotions`, PUT `/promotions/:id`
- **Problem:** No Joi schema middleware on promotion write routes. Missing `name` or `offer_type` cause NULL inserts or raw MySQL constraint errors exposed to the client.
- **Impact:** Invalid requests reach the DB; users see raw SQL errors instead of validation messages.
- **Fix:** Create and apply a Joi validation schema for promotion creation and update payloads.

---

#### BUG-N24 — `ORDER BY ${orderColumn}` direct interpolation in customer query — SQL injection pattern
- **Severity:** ⚠️ Medium
- **Lines:** service.js 234, 247
- **Problem:** `const orderColumn = sortBy === 'points_balance' ? sortBy : `c.${sortBy}`;` then `ORDER BY ${orderColumn}` interpolated directly into SQL. Any future bypass of `parsePagination` allowlist validation makes this a SQL injection vector.
- **Impact:** SQL injection if `parsePagination` validation is bypassed.
- **Fix:** Use a column-name map: `const COL = { name: 'c.name', points_balance: 'points_balance', ... }; ORDER BY ${COL[sortBy]}`.

---

#### BUG-N25 — `ORDER BY lt.${sortBy}` direct interpolation in transactions query
- **Severity:** ⚠️ Medium
- **Line:** service.js 332
- **Problem:** Same unsafe pattern as BUG-N24 in the `getTransactions` query.
- **Impact:** SQL injection if `parsePagination` validation is bypassed.
- **Fix:** Same column-map fix as BUG-N24.

---

### marketplace-credentials

> `src/modules/marketplace-credentials/repository.js`

---

#### BUG-N20 — `findById` uses `SELECT *` — raw API secrets held in memory unnecessarily
- **Severity:** 🔵 Low
- **Lines:** repository.js 28–30
- **Problem:** `findById` selects all columns including `api_key`, `api_secret`, `access_token`, `refresh_token`. The service calls `maskSecrets()` before returning to the controller, but the raw secrets sit in Node.js memory. If `maskSecrets` is ever removed or bypassed, full secrets leak to API responses.
- **Impact:** Raw credential secrets in process memory on every `upsert` / `getByPlatform` call.
- **Fix:** Replace `SELECT *` with an explicit non-secret column list in `findById`, matching what `findAll` already does.

---

### marketplace-orders

> `src/modules/marketplace-orders/routes.js`

---

#### BUG-N12 — PATCH `/marketplace/orders/:id/status` has no request body validation
- **Severity:** 🔶 High
- **Lines:** routes.js 13–16
- **Problem:** No Joi validation middleware on the status-update route. Fields `tracking_number`, `shipped_at`, `wms_sales_order_id` are read directly from `req.body` with no type or format checks. Arbitrary strings reach the DB UPDATE.
- **Impact:** Unvalidated input (malformed dates, injection-style strings) reaches the DB update.
- **Fix:** Add a Joi schema validating `status` (enum), `tracking_number` (string, optional), `shipped_at` (ISO date string, optional).

---

### marketplace-pricing

> `src/modules/marketplace-pricing/routes.js`, `repository.js`

---

#### BUG-N11 — POST `/marketplace/pricing` has no request body validation
- **Severity:** 🔶 High
- **Lines:** routes.js 9–14
- **Problem:** No Joi schema on the upsert route. `product_id`, `platform`, and `price` are read directly from `req.body`. Invalid UUIDs, missing fields, or wrong types reach the service and produce cryptic MySQL 500 errors.
- **Impact:** Malformed requests surface raw DB errors instead of clean 422 validation responses.
- **Fix:** Create and apply a Joi schema for the pricing upsert payload.

---

#### BUG-N23 — Pricing upsert has TOCTOU race — concurrent requests create duplicate rows
- **Severity:** ⚠️ Medium
- **Lines:** repository.js 40–57
- **Problem:** `upsert` reads `findByProductAndPlatform`, then branches on existence. Two concurrent requests both reading "not found" both execute INSERT, creating duplicate rows for the same `(tenant_id, product_id, platform)`. No unique DB constraint exists.
- **Impact:** Duplicate pricing rows; `getAll` returns duplicates; pricing is ambiguous.
- **Fix:** Add a unique constraint on `(tenant_id, product_id, platform)`; use `INSERT ... ON DUPLICATE KEY UPDATE price = VALUES(price)`.

---

### marketplace-returns

> `src/modules/marketplace-returns/routes.js`

---

#### BUG-N13 — PATCH `/marketplace/returns/:id/status` has no request body validation
- **Severity:** 🔶 High
- **Lines:** routes.js 12–15
- **Problem:** Same pattern as BUG-N12. No Joi validation middleware on the return status-update route. Unvalidated user input reaches the DB UPDATE statement.
- **Impact:** Type errors or injection-style strings for status fields reach the DB.
- **Fix:** Add a Joi schema for the return status-update payload.

---

### marketplace-sync

> `src/modules/marketplace-sync/repository.js`

---

#### BUG-N10 — Health query uses `MAX(id)` on UUID — shows wrong (non-latest) sync log
- **Severity:** 🔶 High
- **Lines:** repository.js 8–26
- **Problem:** Subquery uses `SELECT MAX(id) FROM marketplace_sync_logs GROUP BY platform, sync_type`. Since `id` is a UUID v4 (random string), `MAX(id)` returns the lexicographically largest UUID — NOT the most recently inserted row. Latest sync status per platform is incorrect.
- **Impact:** Sync health dashboard shows a random (not latest) status per platform; operators cannot reliably detect failures.
- **Fix:** Replace with `ORDER BY started_at DESC LIMIT 1` subquery per `(platform, sync_type)` group.

---

#### BUG-N26 — Sync log created with `status='partial'` as initial value
- **Severity:** 🔵 Low
- **Lines:** repository.js 50–57
- **Problem:** New sync logs are inserted with `status = 'partial'`. If the sync process crashes between `createLog` and `finishLog`, the log stays `'partial'` forever — indistinguishable from a genuine partial sync.
- **Impact:** Crashed syncs appear as `'partial'` instead of `'error'`; operators cannot tell crash from partial completion.
- **Fix:** Use `status = 'running'` as the initial value; update to `'partial'` or `'error'` only inside `finishLog`.

---

### production-batches

> `src/modules/production-batches/service.js`, `controller.js`

---

#### BUG-N01 — Doc number generated OUTSIDE main transaction — race condition burns sequence numbers
- **Severity:** 🔴 Critical
- **Lines:** service.js 24–39
- **Problem:** `generateDocNumber` is called at line 24 before `beginTransaction()` at line 25. The counter is committed in its own sub-transaction. If the main transaction rolls back (DB constraint, validation), the document number is permanently consumed. Under concurrent load, two callers in `generateDocNumber` simultaneously can obtain the same number.
- **Impact:** Skipped/burned document numbers on every failed insert; potential duplicate batch numbers under high concurrency.
- **Fix:** Move `generateDocNumber` inside the main transaction block so the counter increment and the batch INSERT share the same transaction and roll back together.

---

#### BUG-N04 — DELETE controller returns HTTP 200 instead of 204
- **Severity:** 🔶 High
- **Lines:** controller.js 63–68
- **Problem:** `remove` calls `success(res, result, 'Batch deleted')` — HTTP 200 with a JSON body. All other DELETE endpoints in the codebase call `res.status(204).send()`. REST clients checking for 204 may loop or show incorrect error states.
- **Impact:** Inconsistent API contract; clients expecting 204 on DELETE may misbehave.
- **Fix:** Replace `success(res, ...)` with `res.status(204).send()` in the `remove` handler.

---

#### BUG-N22 — Post-commit `findById` can return stale data on replicated MySQL
- **Severity:** 🔵 Low
- **Line:** service.js 39
- **Problem:** After `trx.commit()`, the code immediately calls `repo.findById(id, tenantId)` outside any transaction. On replicated MySQL, a replica read may not yet reflect the newly committed row.
- **Impact:** Newly created batch may be missing from the API response on replicated MySQL deployments.
- **Fix:** Route the post-commit read to the primary using `db.primary()` or equivalent read-after-write strategy.

---

### production-orders

> `src/modules/production-orders/service.js`, `controller.js`, `repository.js`

---

#### BUG-N02 — Doc number generated OUTSIDE main transaction — same race condition as BUG-N01
- **Severity:** 🔴 Critical
- **Lines:** service.js 32–33
- **Problem:** Identical to BUG-N01. `generateDocNumber` called before `beginTransaction()`. Counter committed in sub-transaction; any main-transaction rollback permanently burns the order number.
- **Impact:** Wasted production order numbers on failed inserts; potential duplicate order numbers under concurrency.
- **Fix:** Move `generateDocNumber` inside the main transaction (same fix as BUG-N01).

---

#### BUG-N05 — DELETE controller returns HTTP 200 instead of 204
- **Severity:** 🔶 High
- **Lines:** controller.js 62–67
- **Problem:** Same pattern as BUG-N04. `remove` returns `success(res, result, 'Production order deleted')` (HTTP 200) instead of `res.status(204).send()`.
- **Impact:** Inconsistent API contract.
- **Fix:** Replace `success(res, ...)` with `res.status(204).send()`.

---

#### BUG-N19 — `sortBy` query parameter silently ignored in materials and outputs list
- **Severity:** ⚠️ Medium
- **Lines:** repository.js 162–163, 206–207
- **Problem:** Both `findAllMaterials` and `findAllOutputs` extract `sortBy` from `parsePagination` but hardcode `ORDER BY m.created_at` / `ORDER BY o.created_at`, ignoring the extracted `sortBy` value. The `product_name` and `planned_qty` sort options have no effect.
- **Impact:** Sort-by parameter is silently ignored; always sorts by `created_at`.
- **Fix:** Map `sortBy` to the correct table-qualified column name and use it in the ORDER BY clause.

---

---

## FRONTEND — OPEN BUGS

---

### Frontend — ApprovalRequestsPage

> `src/pages/ApprovalRequestsPage.tsx`

---

#### BUG-F04 — Fragment in `rows.map()` missing `key` — React reconciliation bug
- **Severity:** 🔶 High
- **Lines:** 333–390
- **Problem:** `rows.map((row) => (<> <tr key={row.id}> ... </> ))` — the outer `<>` Fragment has no `key`. React requires the outermost element from each map callback to carry the key. This produces a React key warning and incorrect DOM reconciliation when rows expand/collapse.
- **Impact:** React console warning; UI flicker or wrong row rendering during rapid expand/collapse.
- **Fix:** Replace `<>` with `<Fragment key={row.id}>` (import `Fragment` from `react`).

---

### Frontend — LoyaltyPage

> `src/pages/LoyaltyPage.tsx`

---

#### BUG-F05 — `saveSettings` mutation has no `onError` — silent failure
- **Severity:** 🔶 High
- **Lines:** 127–133
- **Problem:** Mutation defines `onSuccess` but no `onError`. If the API call fails, the save button re-enables with no form-level error message and no retry guidance.
- **Impact:** Users believe settings were saved when they were not.
- **Fix:** Add `onError: (e) => toast.error(extractApiError(e, 'Failed to save loyalty rules'))`.

---

#### BUG-F06 — `createReferral` mutation has no `onError` handler
- **Severity:** 🔶 High
- **Lines:** 155–161
- **Problem:** No `onError` on the create referral mutation. Failed calls produce no mutation-specific feedback; users may click Submit again, sending duplicate requests.
- **Impact:** Possible duplicate referral creation on retry; no actionable error feedback.
- **Fix:** Add `onError: (e) => toast.error(extractApiError(e, 'Failed to create referral'))`.

---

#### BUG-F07 — `completeReferral` mutation has no `onError` handler
- **Severity:** 🔶 High
- **Lines:** 163–169
- **Problem:** No `onError` on the complete referral mutation. Failures (insufficient points, DB error) produce no actionable feedback.
- **Impact:** Silent failure; users cannot tell if referral completion succeeded or failed.
- **Fix:** Add `onError: (e) => toast.error(extractApiError(e, 'Failed to complete referral'))`.

---

#### BUG-F12 — `useEffect` wipes unsaved settings edits on every background refetch
- **Severity:** ⚠️ Medium
- **Lines:** 119–122
- **Problem:** `useEffect(() => { setSettingsDraft(settings); }, [settings])` resets the draft whenever `settings` changes. React Query refetches on window focus by default (no `staleTime` set) and returns a new object reference even when values are identical. A user editing the form who switches browser tabs and returns loses all unsaved changes.
- **Impact:** Unsaved settings changes silently discarded on every window focus event.
- **Fix:** Add `staleTime: 5 * 60 * 1000` to the overview query; or compare values before calling `setSettingsDraft` to avoid resetting when data is unchanged.

---

### Frontend — Marketplace Pages

> `src/pages/marketplace/`

---

#### BUG-F03 — Pricing form not reset on dialog close — stale values pre-fill next Add dialog
- **Severity:** 🔶 High
- **File:** `MarketplacePricingPage.tsx` lines 79–86
- **Problem:** The dialog close/cancel handler calls `setDialogOpen(false)` but does NOT call `openAdd()` to reset form state. After editing a row and closing without submitting, clicking `+ Set Price` pre-fills the form with the previous row's `product_id` and `platform`, risking an accidental overwrite.
- **Impact:** New price entries accidentally update existing rows when form is not reset after an edit.
- **Fix:** Call `openAdd()` inside the dialog's `onOpenChange` handler when `open === false`.

---

#### BUG-F09 — Marketplace pages use `useToast` (shadcn) — mixed toast libraries
- **Severity:** ⚠️ Medium
- **Files:** `MarketplaceOrdersPage.tsx` line 7 · `MarketplaceCredentialsPage.tsx` line 8 · `MarketplacePricingPage.tsx` line 7
- **Problem:** All three marketplace pages import `useToast` from `@/hooks/use-toast` (shadcn). All new production pages and `ApprovalRequestsPage` use `toast` from `sonner`. Two toast systems are active; notifications render inconsistently; one library's `<Toaster>` may not be mounted.
- **Impact:** Marketplace toasts may be invisible or styled differently from the rest of the app.
- **Fix:** Replace `useToast` with `import { toast } from 'sonner'` and update all `toast(...)` call sites in the three files.

---

#### BUG-F10 — Per-row action buttons missing `isPending` guard — double-submit possible
- **Severity:** ⚠️ Medium
- **File:** `MarketplaceOrdersPage.tsx` lines 211–220
- **Problem:** Table-row Confirm/Ship action buttons call `updateStatusMutation.mutate(...)` with no `disabled={updateStatusMutation.isPending}` guard (the ship dialog button correctly has this guard, but the inline row buttons do not). Multiple rows can be clicked while the first request is still in flight.
- **Impact:** Concurrent duplicate status-update requests when user rapidly clicks multiple rows.
- **Fix:** Track `pendingRowId` in state; disable action buttons when `pendingRowId === row.id`.

---

#### BUG-F14 — MarketplaceSyncPage shows no error state when health query fails
- **Severity:** ⚠️ Medium
- **File:** `MarketplaceSyncPage.tsx` lines 35–39
- **Problem:** When the health query fails (network error, server 500), `health` is `undefined` and the page silently shows all platforms as "Not Connected / Last sync: never" with no indication the health check itself failed.
- **Impact:** Operators cannot distinguish "genuinely disconnected" from "health check endpoint failed".
- **Fix:** Render an error state: `if (healthQuery.isError) return <ErrorAlert message="Could not load sync health." />`.

---

### Frontend — Production Pages

> `src/pages/production/`

---

#### BUG-F01 — Item rows use array index as React key — stale DOM on row removal
- **Severity:** 🔶 High
- **File:** `ProductionOrdersPage.tsx` line 70
- **Problem:** `rows.map((row, i) => (<div key={i} ...>))` uses array index as key. Removing a row from the middle causes React to reuse DOM nodes for wrong rows, shifting controlled input values.
- **Impact:** Wrong material/output data submitted when a non-last row is removed.
- **Fix:** Use `row.id` or a stable `row.tempId` (UUID generated at row creation time) as the React key.

---

#### BUG-F02 — Delete uses native `confirm()` — blocked in PWA and iframe contexts
- **Severity:** 🔶 High
- **File:** `ProductionBatchesPage.tsx` line 265
- **Problem:** `if (confirm(t('production.batches.confirmDelete'))) deleteMut.mutate(r.id)` — `window.confirm` is blocked (always returns `false`) in cross-origin iframes and PWA contexts. The rest of the codebase uses the `DeleteConfirmDialog` component.
- **Impact:** Delete button silently does nothing in iframe/PWA deployments; inconsistent UX.
- **Fix:** Replace with `<DeleteConfirmDialog>` component consistent with the rest of the application.

---

#### BUG-F08 — `fmt()` renders `₹NaN` for missing cost values
- **Severity:** ⚠️ Medium
- **File:** `ProductionCostsPage.tsx` lines 17–18
- **Problem:** `fmt(n)` calls `Number(n).toLocaleString(...)`. When `n` is `undefined`, `Number(undefined)` is `NaN` and `NaN.toLocaleString()` returns `'NaN'`, rendering `₹NaN` in summary cards.
- **Impact:** Cost summary cards display `₹NaN` when any cost field is absent in the API response.
- **Fix:** Guard with `Number(n ?? 0).toLocaleString(...)`.

---

#### BUG-F15 — `any`-typed API response without null safety — runtime TypeError
- **Severity:** 🔵 Low
- **File:** `ProductionOrdersPage.tsx` lines 154–155
- **Problem:** `warehousesData?.data?.map((w: any) => ...)` — `?.` handles `undefined` but not `null`. If the API returns `{ data: null }`, calling `.map()` on `null` throws `TypeError: null is not iterable`.
- **Impact:** Page crashes if warehouse/product list API returns `{ data: null }`.
- **Fix:** Add `?? []` after `.data`: `(warehousesData?.data ?? []).map(...)`.

---

#### BUG-F16 — `unit_cost` renders as `₹NaN` for null values
- **Severity:** 🔵 Low
- **Files:** `ProductionMaterialsPage.tsx` line 99 · `ProductionFinishedGoodsPage.tsx` line 109
- **Problem:** `` `₹${Number(r.unit_cost).toFixed(2)}` `` — `Number(undefined)` is `NaN`; `NaN.toFixed(2)` returns `'NaN'`, rendering `₹NaN` in the Unit Cost column for items with no cost set.
- **Impact:** `₹NaN` displayed in Unit Cost column when `unit_cost` is null or undefined.
- **Fix:** `` `₹${Number(r.unit_cost ?? 0).toFixed(2)}` ``

---

### Frontend — hooks/usePaginatedApi

> `src/hooks/usePaginatedApi.ts`

---

#### BUG-F11 — Infinite refetch loop when `fetchFn` is not memoized by the caller
- **Severity:** ⚠️ Medium
- **Lines:** 35–61
- **Problem:** `fetch` is memoized with `useCallback([fetchFn, params])`. If the caller passes an inline arrow function as `fetchFn`, the reference changes on every render → `fetch` is recreated → effect re-runs → infinite API request loop. An `// eslint-disable-next-line` comment at line 60 suppresses the lint warning, masking the bug.
- **Impact:** Infinite API call loop if `fetchFn` is not memoized at the call site; performance degradation and potential rate-limit triggering.
- **Fix:** Document that `fetchFn` must be wrapped in `useCallback` by the caller; or use `useDeepCompareMemo` to stabilize the `params` dependency inside the hook.

---

#### BUG-F13 — Inline `params` object causes reference instability — root cause of BUG-F11
- **Severity:** ⚠️ Medium
- **Line:** 35
- **Problem:** `params` is in `useCallback`'s dependency array. Callers that pass an inline object literal `{ page, limit, search }` get a new object reference every render, causing `fetch` to be recreated and triggering the infinite loop described in BUG-F11.
- **Impact:** All callers using inline `params` objects enter the infinite-fetch loop.
- **Fix:** Stabilize `params` with `useMemo` at the call site, or use deep-equality comparison for the `params` dependency inside the hook.

---

*End of open bugs index.*
