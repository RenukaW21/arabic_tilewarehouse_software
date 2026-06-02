# Bug Report — Tiles Warehouse Management System

**Audited:** 2026-05-27 (initial), 2026-06-02 (re-audit)
**Last Updated:** 2026-06-02 — 30 new bugs found in production, marketplace, loyalty, approval-requests modules
**Scope:** Full codebase — all backend modules + all frontend components

---

## Summary

### Initial Audit (2026-05-27) — All 41 bugs resolved

| Severity | Backend Total | Backend Fixed | Frontend Total | Frontend Fixed |
|----------|--------------|--------------|----------------|----------------|
| Critical | 3 | **3** | 3 | **3** |
| High | 10 | **10** | 4 | **4** |
| Medium | 8 | **8** | 6 | **6** |
| Low | 4 | **4** | 3 | **3** |
| **Total** | **25** | **25** | **16** | **16** |

### Re-Audit (2026-06-02) — 30 new open bugs

| Severity | Backend Open | Frontend Open |
|----------|-------------|---------------|
| Critical | 3 | 0 |
| High | 10 | 6 |
| Medium | 6 | 7 |
| Low | 5 | 2 |
| **Total** | **24** | **15** |

---

---

## NEW BACKEND BUGS (2026-06-02 Audit)

---

### CRITICAL

---

#### BUG-N01 — Doc number generated OUTSIDE transaction in production-batches — race condition
- **File:** `src/modules/production-batches/service.js` lines 24–39
- **Problem:** In `create()`, `generateDocNumber` is called at line 24 before `beginTransaction()` at line 25. `generateDocNumber` uses its own internal transaction with `FOR UPDATE` locking, but the batch row insertion happens in a separate, later transaction. If the main transaction rolls back (e.g. due to a DB constraint error), the document number counter has already been committed and incremented — permanently burning a sequence number. Under concurrent load, two callers both inside `generateDocNumber` simultaneously can obtain the same number if locking is briefly unavailable.
- **Impact:** Wasted/skipped document numbers on every failed insert. Potential duplicate batch numbers under high concurrency.
- **Status:** 🔴 OPEN

---

#### BUG-N02 — Doc number generated OUTSIDE transaction in production-orders — race condition
- **File:** `src/modules/production-orders/service.js` lines 32–33
- **Problem:** Identical pattern to BUG-N01. `generateDocNumber` is called before `beginTransaction()`. Counter is committed in a sub-transaction, so any subsequent rollback of the main transaction wastes the number.
- **Impact:** Wasted production order numbers on failed inserts; potential duplicates under extreme concurrency.
- **Status:** 🔴 OPEN

---

#### BUG-N03 — Approval `approve()` fires downstream stock action BEFORE marking request approved — partial failure causes double deduction
- **File:** `src/modules/approval-requests/service.js` lines 64–92
- **Problem:** In `approve()`, `adjService.approve(row.reference_id, tenantId, userId)` is called (line ~74) to apply the stock movement, then `repo.setApproved(id, ...)` is called (line ~80) to mark the approval request as approved. The two calls are NOT wrapped in a shared transaction. If `adjService.approve` succeeds but `repo.setApproved` fails (DB timeout, connection drop), the stock movement is permanently applied but the approval_request row stays `pending`. A second admin click will re-apply the stock movement, causing a double deduction or double credit.
- **Impact:** Double stock movement (deduction or addition) if the approve endpoint is retried after a partial failure.
- **Status:** 🔴 OPEN

---

### HIGH

---

#### BUG-N04 — DELETE production-batch returns HTTP 200 instead of 204
- **File:** `src/modules/production-batches/controller.js` lines 63–68
- **Problem:** The `remove` handler calls `success(res, result, 'Batch deleted')` which sends HTTP 200 with a JSON body. All other DELETE endpoints in the codebase use `res.status(204).send()`. Clients checking for 204 to confirm deletion will receive 200 and may loop or show incorrect error state.
- **Impact:** Inconsistent API contract; REST clients expecting 204 on DELETE may misbehave.
- **Status:** 🔴 OPEN

---

#### BUG-N05 — DELETE production-order returns HTTP 200 instead of 204
- **File:** `src/modules/production-orders/controller.js` lines 62–67
- **Problem:** Same pattern as BUG-N04. `remove` returns `success(res, result, 'Production order deleted')` (HTTP 200) instead of `res.status(204).send()`.
- **Impact:** Inconsistent API contract.
- **Status:** 🔴 OPEN

---

#### BUG-N06 — All loyalty controller handlers missing try/catch — rely entirely on express-async-errors
- **File:** `src/modules/loyalty/controller.js` lines 6–55 (all handlers)
- **Problem:** Every handler in the loyalty controller (`getOverview`, `getSettings`, `updateSettings`, `getCustomers`, `getTransactions`, `createTransaction`, `getPromotions`, `createPromotion`, `updatePromotion`, `getReferrals`, `createReferral`, `completeReferral`) calls `await service.*` without a try/catch or `next(err)`. The rest of the codebase explicitly catches errors and calls `next(err)` or uses the `asyncHandler` wrapper. Relying on `express-async-errors` patching alone is fragile; if the patch fails to apply for this file, any service error becomes an unhandled promise rejection that crashes Node.js.
- **Impact:** Server crash on any service-layer error in all loyalty endpoints.
- **Status:** 🔴 OPEN

---

#### BUG-N07 — Loyalty `getBalance` balance check runs outside transaction — TOCTOU race
- **File:** `src/modules/loyalty/service.js` lines 105–119
- **Problem:** `getBalance(tenantId, customerId, trx)` uses `const executor = trx ?? { query }` as a fallback. When a real `trx` is passed, the balance read is inside the transaction. However in `calculateRedemption` (called from `postSalesOrderRewards`), `getBalance` is called with a live `trx` object. Between the read and the subsequent debit, another concurrent transaction could reduce the balance below zero if the DB isolation level allows non-repeatable reads. The fallback `{ query }` object runs outside any transaction, allowing another process to modify the balance between the check and the write.
- **Impact:** Loyalty point balance can go negative if two concurrent transactions both read a positive balance and both debit — classic TOCTOU race.
- **Status:** 🔴 OPEN

---

#### BUG-N08 — `completeReferral` is not atomic — point award and status update not in a transaction
- **File:** `src/modules/loyalty/service.js` lines 441–462
- **Problem:** `completeReferral` calls `addTransaction(...)` (line ~447) and then `query(UPDATE loyalty_referrals SET status = 'rewarded' ...)` (line ~454) sequentially without a wrapping transaction. If `addTransaction` succeeds but the status UPDATE fails (network drop, DB timeout), the referral points are permanently posted but `status` remains `pending`. A retry will award points a second time since the guard `if (referral.status === 'rewarded') return referral` will still pass (status was never updated to `rewarded`).
- **Impact:** Double point award on retry after partial failure.
- **Status:** 🔴 OPEN

---

#### BUG-N09 — Loyalty promotion routes have no Joi validation middleware
- **File:** `src/modules/loyalty/routes.js` — POST `/promotions`, PUT `/promotions/:id`
- **Problem:** Promotion create/update routes have no Joi schema validation middleware. The `createPromotion` and `updatePromotion` service functions access `data.name` and `data.offer_type` directly without checking for undefined. Missing required fields cause either a NULL DB insert (if column is nullable) or a raw MySQL constraint violation error exposed to the client.
- **Impact:** Invalid requests reach the DB; users see raw SQL error messages instead of validation feedback.
- **Status:** 🔴 OPEN

---

#### BUG-N10 — Sync health query uses `MAX(id)` on UUID column — returns wrong (non-latest) log entry
- **File:** `src/modules/marketplace-sync/repository.js` lines 8–26
- **Problem:** The health subquery uses `SELECT MAX(id) FROM marketplace_sync_logs WHERE tenant_id = ? GROUP BY platform, sync_type`. Since `id` is a UUID (v4 random string), `MAX(id)` returns the lexicographically largest UUID, which is NOT the most recently inserted row. The intent is to find the latest log per platform per sync_type, but UUID ordering is unrelated to insertion order.
- **Impact:** The sync health dashboard shows a random (not the most recent) sync status per platform. Operators cannot reliably detect sync failures.
- **Status:** 🔴 OPEN

---

#### BUG-N11 — POST /marketplace/pricing has no request body validation
- **File:** `src/modules/marketplace-pricing/routes.js` lines 9–14
- **Problem:** The upsert route applies `requireRole(...)` and `ctrl.upsert` but no Joi validation schema. The controller reads `req.body.product_id`, `req.body.platform`, and `req.body.price` directly. No validation file exists in the marketplace-pricing module. Invalid UUIDs, missing fields, or wrong types reach the service and produce cryptic DB errors.
- **Impact:** Malformed requests cause MySQL errors surfaced as HTTP 500 instead of clean 422 validation errors.
- **Status:** 🔴 OPEN

---

#### BUG-N12 — PATCH /marketplace/orders/:id/status has no request body validation
- **File:** `src/modules/marketplace-orders/routes.js` lines 13–16
- **Problem:** The `updateStatus` route has no validation middleware. The controller destructures `{ status, tracking_number, shipped_at, wms_sales_order_id }` directly from `req.body`. While `status` is validated against `VALID_STATUSES` in the service, there is no input validation for the shape or types of other fields. Arbitrary strings in `tracking_number` or malformed dates in `shipped_at` reach the DB without sanitization.
- **Impact:** Type errors or injection-style strings for non-status fields can reach the DB update without sanitization.
- **Status:** 🔴 OPEN

---

#### BUG-N13 — PATCH /marketplace/returns/:id/status has no request body validation
- **File:** `src/modules/marketplace-returns/routes.js` lines 12–15
- **Problem:** Same pattern as BUG-N12. No validation middleware on the status-update route for marketplace returns.
- **Impact:** Unvalidated user input reaches the DB UPDATE statement.
- **Status:** 🔴 OPEN

---

#### BUG-N15 — Rate limiter is commented out — all API endpoints unprotected from abuse
- **File:** `src/app.js` line 171
- **Problem:** `// app.use(`${API}/`, apiLimiter);` — the rate limiter middleware is commented out. The `apiLimiter` import still exists at line 11. Any client (authenticated or not) can send unlimited requests to any endpoint, including `/auth/login`.
- **Impact:** No protection against brute-force password attacks, denial-of-service, or credential stuffing.
- **Status:** 🔴 OPEN

---

#### BUG-N16 — CORS configured to allow ALL origins
- **File:** `src/app.js` lines 153–157
- **Problem:** The CORS origin function is `origin: (_, cb) => cb(null, true)`, which always returns `true` regardless of the request origin. This effectively disables same-origin CORS protection and allows any domain to make credentialed cross-origin requests to the API.
- **Impact:** Malicious web pages on any domain can make authenticated API requests on behalf of logged-in users (CSRF vector when cookies are used).
- **Status:** 🔴 OPEN

---

#### BUG-N17 — Generic `buildCrudRouter` has no role guards on write operations
- **File:** `src/app.js` lines 61–141
- **Problem:** The `buildCrudRouter` helper creates GET/POST/PUT/DELETE routes with only `authenticate` middleware and no `requireRole` or `requireMinRole` guard on write operations. This router is used for `shades`, `batches`, `credit_notes`, `debit_notes`, `notifications`, `audit_logs`, and `low_stock_alerts`. Any authenticated user (even `viewer` role) can POST, PUT, or DELETE these records including audit logs.
- **Impact:** Low-privilege users can create or delete shades, credit notes, debit notes, and tamper with audit logs.
- **Status:** 🔴 OPEN

---

### MEDIUM

---

#### BUG-N19 — `sortBy` query parameter silently ignored for materials and outputs list
- **File:** `src/modules/production-orders/repository.js` lines 162–163, 206–207
- **Problem:** Both `findAllMaterials` and `findAllOutputs` extract `sortBy` from `parsePagination` but then hardcode `ORDER BY m.created_at` / `ORDER BY o.created_at` in the query, ignoring the `sortBy` value entirely. The `product_name`, `planned_qty` sort options advertised by `parsePagination` have no effect.
- **Impact:** Sort-by parameter for `/production-orders/materials` and `/production-orders/outputs` is silently ignored; always sorts by `created_at` regardless of the user's request.
- **Status:** 🔴 OPEN

---

#### BUG-N23 — Marketplace pricing upsert has TOCTOU race — concurrent requests create duplicate rows
- **File:** `src/modules/marketplace-pricing/repository.js` lines 40–57
- **Problem:** The `upsert` function calls `findByProductAndPlatform` and if no record exists, calls INSERT. Two concurrent requests for the same `(tenant_id, product_id, platform)` can both read "not found" simultaneously and both execute the INSERT path, creating duplicate pricing rows. There is no `INSERT ... ON DUPLICATE KEY UPDATE` or unique DB constraint enforced at the application layer.
- **Impact:** Duplicate pricing rows for the same product/platform combination; `getAll` will return duplicates and pricing will be ambiguous.
- **Status:** 🔴 OPEN

---

#### BUG-N24 — `ORDER BY ${orderColumn}` direct string interpolation in loyalty customer query — SQL injection pattern
- **File:** `src/modules/loyalty/service.js` lines 234, 247
- **Problem:** `const orderColumn = sortBy === 'points_balance' ? sortBy : `c.${sortBy}`;` — then `ORDER BY ${orderColumn} ${sortOrder}` is interpolated directly into the SQL. While `parsePagination` validates `sortBy` against an allowlist, the direct template-literal interpolation is an unsafe pattern. Any bypass of `parsePagination` (future refactor, misconfiguration) would expose a SQL injection vector.
- **Impact:** SQL injection if `parsePagination` validation is bypassed in the future. Currently low risk.
- **Status:** 🔴 OPEN

---

#### BUG-N25 — `ORDER BY lt.${sortBy}` direct string interpolation in loyalty transactions query — SQL injection pattern
- **File:** `src/modules/loyalty/service.js` line 332
- **Problem:** Same unsafe pattern as BUG-N24. `ORDER BY lt.${sortBy} ${sortOrder}` is directly interpolated. The `sortBy` value comes from `parsePagination` which validates it, but the interpolation itself is unsafe.
- **Impact:** SQL injection if `parsePagination` validation is bypassed.
- **Status:** 🔴 OPEN

---

#### BUG-N21 — `getSettings` is always called in `createReferral` regardless of whether `reward_points` is provided
- **File:** `src/modules/loyalty/service.js` lines 432–433
- **Problem:** `toNumber(data.reward_points, (await getSettings(tenantId)).referral_reward_points)` — JavaScript evaluates ALL function arguments eagerly. The `await getSettings(tenantId)` runs every time `createReferral` is called, even when `data.reward_points` is explicitly provided, causing an unnecessary DB round-trip on every referral creation.
- **Impact:** Extra DB query on every `createReferral` call regardless of whether a custom `reward_points` was provided.
- **Status:** 🔴 OPEN

---

#### BUG-N26 — Sync log created with `status='partial'` as initial value — crashed syncs are misrepresented
- **File:** `src/modules/marketplace-sync/repository.js` lines 50–57
- **Problem:** When a new sync log is created, its initial status is hardcoded as `'partial'`. The `finishLog` function updates it to the final value. If the sync process crashes between `createLog` and `finishLog`, the log stays as `'partial'` permanently, which is indistinguishable from a genuine partial sync. Operators cannot tell the difference between "sync partially completed" and "sync process crashed".
- **Impact:** Failed/crashed syncs appear as `'partial'` in the health dashboard rather than `'error'`, hiding failures from operators.
- **Status:** 🔴 OPEN

---

### LOW

---

#### BUG-N18 — `/alerts` route registered twice — second registration is dead code
- **File:** `src/app.js` lines 212, 230
- **Problem:** Line 212: `app.use(`${API}/alerts`, alertsRoutes)` registers the proper alerts module. Line 230: `app.use(`${API}/alerts`, buildCrudRouter('low_stock_alerts', ...))` registers a second router on the same path. Express uses the first matching router, making the `buildCrudRouter` registration dead code. If the registration order were ever swapped, the unguarded generic router (no role guards) would serve all alert endpoints.
- **Impact:** Dead code; maintenance confusion; security risk if registration order changes.
- **Status:** 🔴 OPEN

---

#### BUG-N20 — `repo.findByPlatform` and `repo.findById` use `SELECT *` on credentials table — secrets held in memory unnecessarily
- **File:** `src/modules/marketplace-credentials/repository.js` lines 28–30
- **Problem:** `findById` uses `SELECT *` which returns `api_key`, `api_secret`, `access_token`, `refresh_token` to the service layer. The service applies `maskSecrets()` before returning to the controller. While masking happens, the raw secrets are held in Node.js process memory longer than necessary. The list endpoint `findAll` correctly selects only non-secret columns.
- **Impact:** Low current risk; raw API secrets exist in memory on every `upsert`/`getByPlatform` call; if maskSecrets is ever bypassed or removed, full secrets would leak.
- **Status:** 🔴 OPEN

---

#### BUG-N22 — Post-commit `findById` in production-batches can return stale data on replicated MySQL
- **File:** `src/modules/production-batches/service.js` line 39
- **Problem:** After `trx.commit()`, the code immediately calls `repo.findById(id, tenantId)` outside the transaction. On replicated MySQL setups, a read from a replica could return stale data (the newly inserted row may not have replicated yet). This is architecturally incorrect even if it works on single-node setups.
- **Impact:** Newly created batch may not be returned in the API response on replicated MySQL deployments.
- **Status:** 🔴 OPEN

---

---

## NEW FRONTEND BUGS (2026-06-02 Audit)

---

### HIGH

---

#### BUG-F01 — Production order item rows use array index as React key — stale DOM on row removal
- **File:** `src/pages/production/ProductionOrdersPage.tsx` line 70
- **Problem:** `rows.map((row, i) => (<div key={i} ...>))` uses the array index as the `key` prop. When a row is removed from the middle or items are reordered, React reuses DOM nodes for wrong rows, causing input field values to appear at the wrong positions (stale controlled input values).
- **Impact:** Removing a material/output row that is not the last one shifts displayed values incorrectly; wrong data can be submitted.
- **Status:** 🔴 OPEN

---

#### BUG-F02 — Production batches delete uses native `confirm()` — blocked in PWA/iframe contexts
- **File:** `src/pages/production/ProductionBatchesPage.tsx` line 265
- **Problem:** `if (confirm(t('production.batches.confirmDelete'))) deleteMut.mutate(r.id)`. The `window.confirm` dialog is synchronous and is blocked (always returns `false`) in cross-origin iframes and some Progressive Web App contexts. The rest of the codebase uses the `DeleteConfirmDialog` component for this purpose.
- **Impact:** Delete button silently does nothing in iframe/PWA deployments; inconsistent UX.
- **Status:** 🔴 OPEN

---

#### BUG-F03 — Marketplace pricing form not reset on dialog close — stale values pre-fill next Add dialog
- **File:** `src/pages/marketplace/MarketplacePricingPage.tsx` lines 79–86
- **Problem:** The dialog close button calls `setDialogOpen(false)` but does NOT call `openAdd()` to reset the form. After editing a row and closing without submitting, clicking `+ Set Price` will pre-fill the form with the previous row's `product_id` and `platform`, likely causing an accidental update instead of a new entry.
- **Impact:** Users creating a new price entry after closing an edit dialog see the previous row's data pre-filled, leading to accidental overwrites.
- **Status:** 🔴 OPEN

---

#### BUG-F04 — `rows.map()` in ApprovalRequestsPage returns Fragment without `key` — React reconciliation bug
- **File:** `src/pages/ApprovalRequestsPage.tsx` lines 333–390
- **Problem:** `rows.map((row) => (<> <tr key={row.id}...> ... </> ))` — the outer `<>` Fragment has no `key` prop. React requires the outermost element returned by each map callback to have a unique `key`. The `key` on the inner `<tr>` does not satisfy this requirement. This produces a React key warning and can cause incorrect DOM reconciliation when rows expand/collapse.
- **Impact:** React console warning; potential UI flicker or incorrect rendering when rows expand/collapse under fast state changes.
- **Status:** 🔴 OPEN

---

#### BUG-F05 — Loyalty `saveSettings` mutation has no `onError` handler — silent failure
- **File:** `src/pages/LoyaltyPage.tsx` lines 127–133
- **Problem:** The `saveSettings` mutation defines `onSuccess` but has no `onError` callback. If `loyaltyApi.updateSettings` fails, the user has no mutation-specific feedback: the save button re-enables, no error is shown in the form, and the user cannot tell whether their settings were saved.
- **Impact:** Users believe settings were saved when they were not; no guidance to retry.
- **Status:** 🔴 OPEN

---

#### BUG-F06 — Loyalty `createReferral` mutation has no `onError` handler
- **File:** `src/pages/LoyaltyPage.tsx` lines 155–161
- **Problem:** The `createReferral` mutation has `onSuccess` but no `onError`. If the API call fails, the dialog stays open (correct) but there is no mutation-specific error message. Users may click Submit again, sending duplicate requests.
- **Impact:** Possible duplicate referral creation on user retry; no actionable error feedback.
- **Status:** 🔴 OPEN

---

#### BUG-F07 — Loyalty `completeReferral` mutation has no `onError` handler
- **File:** `src/pages/LoyaltyPage.tsx` lines 163–169
- **Problem:** The `completeReferral` mutation has `onSuccess` but no `onError`. If reward posting fails (insufficient points, DB error), the button appears to do nothing with no actionable feedback.
- **Impact:** Silent failure; users have no indication the referral completion failed.
- **Status:** 🔴 OPEN

---

### MEDIUM

---

#### BUG-F08 — Production costs `fmt()` renders `₹NaN` for non-numeric API values
- **File:** `src/pages/production/ProductionCostsPage.tsx` lines 17–18
- **Problem:** `fmt(n)` calls `Number(n).toLocaleString(...)`. If `n` is `undefined`, `Number(undefined)` is `NaN`, and `NaN.toLocaleString()` returns `'NaN'`, rendering `₹NaN` in cost summary cards. The `data?.summary ?? {}` fallback does not protect against the case where `summary` fields are individually missing from the API response.
- **Impact:** Summary cards display `₹NaN` when any cost field is missing or non-numeric.
- **Status:** 🔴 OPEN

---

#### BUG-F09 — Marketplace pages use `useToast` (shadcn) while rest of new modules use `sonner` toast
- **File:** `src/pages/marketplace/MarketplaceOrdersPage.tsx` line 7; `src/pages/marketplace/MarketplaceCredentialsPage.tsx` line 8; `src/pages/marketplace/MarketplacePricingPage.tsx` line 7
- **Problem:** All three marketplace pages import `useToast` from `@/hooks/use-toast` (shadcn/ui's toast system). All new production pages and ApprovalRequestsPage use `toast` from `sonner`. This mixes two toast libraries in the same application. Notifications from the two systems render differently and one library's `<Toaster>` component may not be mounted in the app root.
- **Impact:** Inconsistent notification styling; toasts from marketplace pages may be invisible if the shadcn Toaster is not mounted.
- **Status:** 🔴 OPEN

---

#### BUG-F10 — Marketplace orders per-row Confirm buttons have no `isPending` guard — allow double-submit
- **File:** `src/pages/marketplace/MarketplaceOrdersPage.tsx` lines 211–220
- **Problem:** The per-row action buttons (Confirm, Ship) for marketplace orders do not check `updateStatusMutation.isPending` before calling `updateStatusMutation.mutate(...)`. The ship dialog's Confirm button correctly uses `disabled={updateStatusMutation.isPending}`, but the table-row action buttons do not. Multiple rows can be clicked in rapid succession, sending concurrent PATCH requests.
- **Impact:** Double-confirmation requests sent if the user clicks Confirm on multiple rows while the first request is in flight.
- **Status:** 🔴 OPEN

---

#### BUG-F11 — `usePaginatedApi` can enter an infinite refetch loop if `fetchFn` is not memoized by caller
- **File:** `src/hooks/usePaginatedApi.ts` lines 35–61
- **Problem:** The `fetch` callback is memoized with `useCallback([fetchFn, params])`. The `useEffect` depends on `[fetch]`. If a caller passes an inline arrow function as `fetchFn` (e.g. `usePaginatedApi(() => productApi.getAll(params), ...)`), the reference changes on every render, causing `fetch` to be recreated, causing the effect to re-run — creating an infinite API request loop. An `// eslint-disable-next-line` comment at line 60 suppresses the exhaustive-deps warning, masking the design problem.
- **Impact:** Infinite API request loop if `fetchFn` is not memoized by the caller; performance degradation and potential rate-limit triggering.
- **Status:** 🔴 OPEN

---

#### BUG-F12 — Loyalty settings `useEffect` wipes unsaved user edits on every background query refetch
- **File:** `src/pages/LoyaltyPage.tsx` lines 119–122
- **Problem:** `useEffect(() => { setSettingsDraft(settings); }, [settings])` resets the draft form state whenever `settings` changes. Since `overviewQuery` has no `staleTime` configured, React Query refetches on window focus by default. When the user is editing the loyalty settings form and switches to another browser tab and back, the query refetches, `settings` object reference changes (new object reference even if values are the same), and `setSettingsDraft(settings)` is called, wiping out all unsaved edits.
- **Impact:** User's unsaved settings changes are silently discarded when the user switches browser tabs while editing.
- **Status:** 🔴 OPEN

---

#### BUG-F13 — `usePaginatedApi` uses inline object `params` in dependency — reference instability
- **File:** `src/hooks/usePaginatedApi.ts` line 35
- **Problem:** `params` is part of the `useCallback` dependency array. If the caller passes an inline object literal `{page, limit, search}` as params, a new object is created each render, causing the `fetch` callback to be re-created every render. This is the root cause that enables the infinite loop in BUG-F11 and means the hook is only safe to use with memoized params.
- **Impact:** All callers using inline `params` objects will trigger the infinite loop described in BUG-F11.
- **Status:** 🔴 OPEN (related to BUG-F11)

---

#### BUG-F14 — MarketplaceSyncPage shows no error state when health query fails
- **File:** `src/pages/marketplace/MarketplaceSyncPage.tsx` lines 35–39
- **Problem:** The `healthData` query uses `refetchInterval: 60_000`. If the query fails (network error, server 500), `healthData` is `undefined`, `health` is `undefined`, and `lastSyncByPlatform` is an empty object. The page silently shows all platforms as "Not Connected / Last sync: never" with no indication the health data failed to load.
- **Impact:** If the health endpoint is down or returns an error, operators see a false "all disconnected" status with no way to distinguish between "genuinely disconnected" and "health check failed".
- **Status:** 🔴 OPEN

---

### LOW

---

#### BUG-F15 — Production pages use `any`-typed API responses without null safety
- **File:** `src/pages/production/ProductionOrdersPage.tsx` lines 154–155
- **Problem:** `warehousesData?.data?.map((w: any) => ...)` — the `any` type suppresses TypeScript safety. The `?.` optional chain handles `undefined` but not `null`. If `warehousesData.data` is `null` (which some API responses return), `null.map()` throws `TypeError: null is not iterable`.
- **Impact:** Runtime TypeError if the API returns `{ data: null }` for the warehouse or product list response.
- **Status:** 🔴 OPEN

---

#### BUG-F16 — `unit_cost` rendered as `₹NaN` for null values in production materials/finished-goods pages
- **File:** `src/pages/production/ProductionMaterialsPage.tsx` line 99; `src/pages/production/ProductionFinishedGoodsPage.tsx` line 109
- **Problem:** `` `₹${Number(r.unit_cost).toFixed(2)}` `` — `Number(undefined)` is `NaN`, and `NaN.toFixed(2)` returns `'NaN'`, rendering `₹NaN` in the Unit Cost column for materials/outputs that have no unit cost set.
- **Impact:** Displays `₹NaN` in the Unit Cost column when `unit_cost` is null or undefined.
- **Status:** 🔴 OPEN

---

---

## Fix Priority Order (2026-06-02 Bugs)

### Immediate (Critical + Security)
| Bug | Fix |
|-----|-----|
| BUG-N03 | Wrap `adjService.approve` + `repo.setApproved` in a shared transaction |
| BUG-N15 | Uncomment and restore rate limiter middleware in app.js |
| BUG-N16 | Restrict CORS origin to allowed domains list from env config |
| BUG-N17 | Add `requireMinRole('admin')` to POST/PUT/DELETE in `buildCrudRouter` |

### High Priority
| Bug | Fix |
|-----|-----|
| BUG-N01 | Move `generateDocNumber` inside the main transaction in production-batches create |
| BUG-N02 | Move `generateDocNumber` inside the main transaction in production-orders create |
| BUG-N08 | Wrap `addTransaction` + status UPDATE in a transaction in `completeReferral` |
| BUG-N07 | Use `SELECT ... FOR UPDATE` inside transaction for loyalty balance check |
| BUG-N10 | Replace `MAX(id)` with `ORDER BY started_at DESC LIMIT 1` subquery in health query |
| BUG-N04 | production-batches controller remove: `res.status(204).send()` |
| BUG-N05 | production-orders controller remove: `res.status(204).send()` |
| BUG-N06 | Wrap all loyalty controller handlers in asyncHandler/try-catch |
| BUG-N09 | Add Joi validation schema to loyalty promotion POST/PUT routes |
| BUG-N11 | Add Joi validation schema to marketplace pricing POST route |
| BUG-N12 | Add Joi validation schema to marketplace orders PATCH status route |
| BUG-N13 | Add Joi validation schema to marketplace returns PATCH status route |
| BUG-F01 | Use `row.id` or a stable identifier as React key in ProductionOrdersPage ItemTable |
| BUG-F02 | Replace `confirm()` with `DeleteConfirmDialog` in ProductionBatchesPage |
| BUG-F04 | Add `key={row.id}` to the Fragment wrapper in ApprovalRequestsPage rows.map |
| BUG-F05 | Add `onError: (e) => toast.error(extractApiError(e, ...))` to saveSettings mutation |
| BUG-F06 | Add `onError` handler to createReferral mutation |
| BUG-F07 | Add `onError` handler to completeReferral mutation |

### Medium Priority
| Bug | Fix |
|-----|-----|
| BUG-N23 | Add unique DB constraint on `(tenant_id, product_id, platform)` in marketplace_pricing; use `INSERT ... ON DUPLICATE KEY UPDATE` |
| BUG-N24 | Replace `ORDER BY ${orderColumn}` with a column-name map object to avoid interpolation |
| BUG-N25 | Same fix as BUG-N24 for loyalty transactions query |
| BUG-N19 | Use `sortBy` value from parsePagination in the ORDER BY clause of findAllMaterials/findAllOutputs |
| BUG-F03 | Call `openAdd()` (reset form) in the dialog close/cancel handler in MarketplacePricingPage |
| BUG-F08 | Guard `fmt(n)` with `Number(n ?? 0)` in ProductionCostsPage |
| BUG-F09 | Standardize all marketplace pages to use `toast` from `sonner` |
| BUG-F10 | Add `disabled` guard on per-row action buttons based on `updateStatusMutation.isPending` for the specific row ID |
| BUG-F11 | Document `usePaginatedApi` requirement for memoized `fetchFn`; add stability guard (JSON.stringify params for dependency comparison or use `useDeepCompareMemo`) |
| BUG-F12 | Add `staleTime: Infinity` (or sufficient TTL) to overviewQuery in LoyaltyPage to prevent background refetch from discarding draft edits |
| BUG-F14 | Add error state rendering to MarketplaceSyncPage when healthData query fails |

### Low Priority
| Bug | Fix |
|-----|-----|
| BUG-N18 | Remove duplicate `/alerts` buildCrudRouter registration from app.js |
| BUG-N20 | Replace `SELECT *` in `repo.findById` for credentials with an explicit column list excluding secrets |
| BUG-N21 | Use `data.reward_points != null ? data.reward_points : (await getSettings(tenantId)).referral_reward_points` to avoid eager evaluation |
| BUG-N22 | Accept the minor risk on single-node; document that replicated setups need read-after-write consistency |
| BUG-N26 | Use `status='running'` as initial sync log status; update to `'partial'` or `'error'` in `finishLog` |
| BUG-F15 | Replace `any` with proper types; add `?? []` fallback for `data` field |
| BUG-F16 | Replace `` `₹${Number(r.unit_cost).toFixed(2)}` `` with `` `₹${(Number(r.unit_cost ?? 0)).toFixed(2)}` `` |

---

---

## INITIAL AUDIT BUGS (2026-05-27) — All 41 Resolved

### BACKEND BUGS

---

#### BUG-B01 — Missing role guards on Customer Payments routes
- **File:** `src/modules/customer-payments/routes.js` lines 8–14
- **Status:** ✅ FIXED — `requireRole(['super_admin', 'admin', 'accountant'])` added to POST, PUT, DELETE.

---

#### BUG-B02 — Missing role guards on Vendor Payments routes
- **File:** `src/modules/vendor-payments/routes.js` lines 6–14
- **Status:** ✅ FIXED — `requireRole(['super_admin', 'admin', 'accountant'])` added to POST, PUT, DELETE.

---

#### BUG-B03 — DELETE `/pick-lists/:id` hangs — no response sent
- **File:** `src/modules/pick-lists/service.js` lines 142–156
- **Status:** ✅ FIXED — `controller.js` `remove()` now calls `res.status(204).send()`.

---

#### BUG-B04 — Silent failure when auto-creating Delivery Challan after pick list complete
- **File:** `src/modules/pick-lists/service.js` lines 91–99
- **Status:** ✅ FIXED — DC failure stored in `_dcWarning` and surfaced in the response message.

---

#### BUG-B05 — Delivery Challan `dispatch()` can crash on null `warehouse_id`
- **File:** `src/modules/delivery-challans/service.js` lines 172–184
- **Status:** ✅ FIXED — `dispatch()` validates `!warehouseId` and throws a clear `AppError`.

---

#### BUG-B06 — Crash when `dc.items` is null in Delivery Challan dispatch
- **File:** `src/modules/delivery-challans/service.js` lines 190–196
- **Status:** ✅ FIXED — `dispatch()` now checks `!dc.items || dc.items.length === 0` before iterating.

---

#### BUG-B07 — Race condition in rack capacity check (no `FOR UPDATE` lock)
- **File:** `src/utils/stockHelper.js` lines 109–132
- **Status:** ✅ FIXED — `racks` query changed to `SELECT ... FOR UPDATE` within the transaction.

---

#### BUG-B08 — Cross-tenant stock access in Purchase Returns `dispatch()`
- **File:** `src/modules/purchase-returns/service.js` lines 119–150
- **Status:** ✅ FIXED — `repo.getStockBalance(trx, tenantId, ...)` explicitly passes `tenantId`.

---

#### BUG-B09 — Cross-tenant warehouse name leak in Delivery Challans query
- **File:** `src/modules/delivery-challans/service.js` lines 224–231
- **Status:** ✅ FIXED — DC repository no longer JOINs the `warehouses` table without tenant scope.

---

#### BUG-B10 — No role guard on Stock Transfers routes (read + write)
- **File:** `src/modules/stock-transfers/transfer.routes.js` lines 13–18
- **Status:** ✅ FIXED — `requireMinRole('warehouse_manager')` added to POST, PUT, and DELETE.

---

#### BUG-B11 — Cross-tenant product reference in Stock Transfer item validation
- **File:** `src/modules/stock-transfers/transfer.service.js` lines 27–59
- **Status:** ✅ FIXED — Query JOINs `products p ON p.id = ss.product_id AND p.tenant_id = ss.tenant_id`.

---

#### BUG-B12 — DELETE `/damage-entries/:id` hangs — no response sent
- **File:** `src/modules/damage-entries/routes.js` line 14
- **Status:** ✅ FIXED — `controller.js` `remove()` now calls `res.status(204).send()`.

---

#### BUG-B13 — Alerts LEFT JOIN missing tenant scope on warehouses
- **File:** `src/modules/alerts/services.js` lines 13–14
- **Status:** ✅ FIXED — JOINs updated to include `tenant_id` conditions.

---

#### BUG-B14 — Duplicate payment record created on Invoice status update
- **File:** `src/modules/invoices/service.js` lines 172–201
- **Status:** ✅ FIXED — Now checks for existing non-cancelled payment before inserting.

---

#### BUG-B15 — Negative line totals possible with 100% discount
- **File:** `src/modules/sales-orders/service.js` lines 57–64
- **Status:** ✅ FIXED — `calcLineTotal` wraps both `afterDiscount` and final result with `Math.max(0, ...)`.

---

#### BUG-B16 — Pick list `complete()` allows picking more quantity than ordered
- **File:** `src/modules/pick-lists/service.js` lines 78–102
- **Status:** ✅ FIXED — `updateItemPicked()` checks `if (picked > requested)` and throws `AppError('OVER_PICK')`.

---

#### BUG-B17 — Stock Count loads items for a deleted warehouse
- **File:** `src/modules/stock-counts/service.js` lines 29–51
- **Status:** ✅ FIXED — `loadFromStock()` validates warehouse exists before entering transaction.

---

#### BUG-B18 — Stock Adjustment: status marked approved before stock write succeeds
- **File:** `src/modules/stock-adjustments/service.js` lines 48–120
- **Status:** ✅ NOT A BUG — Correct order already enforced; both within same transaction.

---

#### BUG-B19 — Adding same product twice to a PO throws confusing error
- **File:** `src/modules/purchase-orders/service.js` lines 94–117
- **Status:** ✅ FIXED — Pre-flight duplicate check added before transaction.

---

#### BUG-B20 — ORDER BY column injected via template literal
- **File:** `src/modules/customer-payments/service.js` lines 44–59
- **Status:** ✅ FIXED — `LIMIT`/`OFFSET` parameterized; `sortBy` validated against explicit allowlist.

---

#### BUG-B21 — Error middleware returns `undefined` when `details` array is empty
- **File:** `src/middlewares/error.middleware.js` line 30
- **Status:** ✅ FIXED — Now uses `err.details?.[0]?.message || err.message` fallback.

---

#### BUG-B22 — DELETE `/invoices/:id` does not explicitly send 204
- **File:** `src/modules/invoices/controller.js` lines 38–45
- **Status:** ✅ FIXED — `remove()` now calls `res.status(204).send()`.

---

#### BUG-B23 — `console.error` used instead of Winston logger in pick-lists
- **File:** `src/modules/pick-lists/service.js` lines 91–99
- **Status:** ✅ FIXED — Replaced with `logger.error(...)`. Fixed with BUG-B04.

---

#### BUG-B24 — GRN route validation potentially duplicated in controller
- **File:** `src/modules/grn/routes.js` line 27
- **Status:** ✅ NOT A BUG — Validation runs exactly once on route middleware.

---

#### BUG-B25 — Sales Return DELETE may not send response
- **File:** `src/modules/sales-returns/routes.js`
- **Status:** ✅ FIXED — `controller.js` `remove()` calls `res.status(204).send()`.

---

### FRONTEND BUGS

---

#### BUG-F01 — Type mismatch crashes Stock Transfer edit flow
- **File:** `src/pages/StockTransfersPage.tsx` line 147
- **Status:** ✅ FIXED — `openEdit()` checks `if (!full)` and uses `??` defaults.

---

#### BUG-F02 — Stock Count update mutation silently swallows errors
- **File:** `src/pages/StockCountsPage.tsx` line 172
- **Status:** ✅ FIXED — `onError` now calls `toast.error(t('stockCounts.updateFailed'))`.

---

#### BUG-F03 — Generic error swallows real failure reason in StockTransfersPage
- **File:** `src/pages/StockTransfersPage.tsx` line 146
- **Status:** ✅ FIXED — Catch surfaces real error message.

---

#### BUG-F04 — No null guard before property access on API response in StockTransfersPage
- **File:** `src/pages/StockTransfersPage.tsx` lines 149–155
- **Status:** ✅ FIXED — All property accesses now use `??` fallbacks.

---

#### BUG-F05 — Inconsistent and fragile error type assumption in InvoicesPage
- **File:** `src/pages/InvoicesPage.tsx` lines 88–90 etc.
- **Status:** ✅ FIXED — Added `extractApiError(e, fallback)` utility; all handlers typed as `unknown`.

---

#### BUG-F06 — `ProductCombobox` silently loses selection when product not found
- **File:** `src/components/shared/LineItemsEditor.tsx` lines 356–361
- **Status:** ✅ FIXED — Unresolved selection highlighted with `border-destructive` styling.

---

#### BUG-F07 — Race condition in `usePaginatedApi` — stale data displayed
- **File:** `src/hooks/usePaginatedApi.ts` lines 35–37
- **Status:** ✅ FIXED — `useEffect` uses `cancelled` flag to discard stale responses.

---

#### BUG-F08 — Dashboard low-stock alerts use `any` type — undefined fields render silently
- **File:** `src/pages/DashboardPage.tsx` line 590
- **Status:** ✅ FIXED — Typed as `LowStockAlert`; all fields use `?? '—'` / `?? 0` fallbacks.

---

#### BUG-F09 — Race condition between two `useEffect`s in `OrderFormDialog`
- **File:** `src/components/shared/OrderFormDialog.tsx` lines 50–76, 78–98
- **Status:** ✅ FIXED — Merged into single atomic state update with pre-computed totals.

---

#### BUG-F10 — `stockTransferApi` double-handles errors
- **File:** `src/api/stockTransferApi.ts` lines 12–25
- **Status:** ✅ FIXED — `isAxiosError(e)` used to avoid double toast.

---

#### BUG-F11 — Auto document number silently fails in `CrudFormDialog`
- **File:** `src/components/shared/CrudFormDialog.tsx` lines 80–84
- **Status:** ✅ FIXED — `.catch()` now shows `toast.error(...)`.

---

#### BUG-F12 — `handleSubmit` error handler accesses properties on unknown error shape
- **File:** `src/components/shared/CrudFormDialog.tsx` lines 142–167
- **Status:** ✅ FIXED — Multi-level fallback: `err?.response?.data?.error?.message ?? ... ?? 'Request failed'`.

---

#### BUG-F13 — Unresolved promise in `OrderFormDialog` `useEffect`
- **File:** `src/components/shared/OrderFormDialog.tsx` lines 64–73
- **Status:** ✅ FIXED — `.catch()` now shows `toast.error(...)`.

---

#### BUG-F14 — Non-unique `key` prop possible in Dashboard category chart
- **File:** `src/pages/DashboardPage.tsx` line 250
- **Status:** ✅ FIXED — `key={`${item.category}-${i}`}` uses index suffix to prevent duplicates.

---

#### BUG-F15 — Inconsistent numeric field handling across pages
- **File:** `src/pages/DashboardPage.tsx` line 341 vs `InvoicesPage.tsx` line 400
- **Status:** ✅ FIXED — Dashboard uses `?? 0` guard; InvoicesPage uses `|| 0`.

---

#### BUG-F16 — Unused import in StockTransfersPage
- **File:** `src/pages/StockTransfersPage.tsx` lines 7–8
- **Status:** ✅ FIXED — `purchaseOrderApi` import removed.
