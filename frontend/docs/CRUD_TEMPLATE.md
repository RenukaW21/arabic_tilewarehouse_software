# Tiles WMS — CRUD Module Template

This document describes the **production-ready CRUD pattern** used for tenant-scoped master data. Use it to add new modules for any table that has `tenant_id` and supports list/create/get/update/delete.

---

## 1. Database Tables (tenant-scoped)

All tables in the schema that have `tenant_id` and are suitable for full CRUD:

| Table | Module name | Search columns | Soft delete |
|-------|-------------|----------------|-------------|
| vendors | vendors | name, code | is_active |
| customers | customers | name, code | is_active |
| warehouses | warehouses | name, code | is_active |
| racks | racks | name, aisle | is_active |
| product_categories | categories | name | is_active |
| products | products | name, code, brand | is_active |
| shades | shades | shade_code | is_active |
| batches | batches | batch_number | — |
| purchase_orders | purchase-orders | po_number | — |
| grn | grn | grn_number | — |
| ... (see schema.sql for full list) | | | |

**Rules:**

- **tenant_id**: Always from JWT (`req.tenantId`). Never from request body.
- **Soft delete**: If table has `is_active` or `deleted_at`, use it instead of DELETE.
- **Parameterized queries only** — no string concatenation for SQL.

---

## 2. Backend Structure (per module)

```
src/modules/<module-name>/
  ├── <module>.routes.js   # GET /, GET /:id, POST /, PUT /:id, DELETE /:id
  ├── <module>.controller.js
  ├── <module>.service.js
  └── <module>.validation.js
```

### 2.1 Routes (`<module>.routes.js`)

- Apply `authenticate` middleware (sets `req.tenantId` from JWT).
- Wire: POST → create, GET / → list, GET /:id → getById, PUT /:id → update, DELETE /:id → delete.

### 2.2 Controller

- **Create**: Validate body with Joi, generate UUID, set `tenant_id = req.tenantId`, call service.create, return `created(res, entity)`.
- **List**: Pass `req.query` to service, return `paginated(res, data, meta)`.
- **GetById**: Call service.getById(id, req.tenantId), if not found throw `AppError('Not found', 404, 'NOT_FOUND')`, return `success(res, entity)`.
- **Update**: Validate body, call service.update(id, req.tenantId, value), return `success(res, updated)`.
- **Delete**: Call service.delete(id, req.tenantId), return 204.

Use `next(e)` for errors so the global error middleware handles them.

### 2.3 Service

- **create(data)**: INSERT with explicit columns; `data.tenant_id` from controller (from JWT).
- **getAll(tenantId, options)**: Use `parsePagination(options, allowedSortFields)`, build WHERE with `tenant_id = ?`, optional search (LIKE on name/code), optional filters. Run data query and COUNT in parallel. Return `{ data: rows, meta: { page, limit, total, totalPages } }`.
- **getById(id, tenantId)**: SELECT by id and tenant_id, return row or null.
- **update(id, tenantId, fields)**: Whitelist allowed fields, build SET clause, UPDATE ... WHERE id AND tenant_id. Return updated entity or null.
- **delete(id, tenantId)**: If `is_active` exists: UPDATE SET is_active = 0; else DELETE. Return boolean.

Use `query()` and `getPool().execute()` from `../../config/db`. Use `parsePagination`, `buildSearchClause`, `buildFilterClauses` from `../../utils/pagination`.

### 2.4 Validation (Joi)

- **createSchema**: All required/optional fields per DB; no id, no tenant_id.
- **updateSchema**: Same as create with `.min(1)`.
- **listQuerySchema** (optional): page, limit, search, sortBy, sortOrder, is_active.

---

## 3. Standard API Response Format

**Single resource (create / getById / update):**

```json
{
  "success": true,
  "message": "Vendor fetched",
  "data": { "id": "...", "tenant_id": "...", "name": "...", ... }
}
```

**List (paginated):**

```json
{
  "success": true,
  "message": "Vendors fetched",
  "data": [ { "id": "...", "name": "...", ... } ],
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 100,
    "totalPages": 4,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Error (e.g. 422 validation):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "\"name\" is required"
  }
}
```

**Delete:** HTTP 204 No Content.

---

## 4. Frontend Pattern

### 4.1 API layer (`api/<entity>Api.ts`)

- Use `api` from `@/lib/api` (Axios with baseURL and Authorization from localStorage).
- **getAll(params?)**: `GET /<entity>?page=&limit=&search=&sortBy=&sortOrder=` → return full response `ApiPaginatedResponse<T>`.
- **getById(id)**: `GET /<entity>/:id` → return `res.data.data` (entity).
- **create(payload)**: `POST /<entity>` → return entity.
- **update(id, payload)**: `PUT /<entity>/:id` → return entity.
- **delete(id)**: `DELETE /<entity>/:id` → return void.

### 4.2 Types (`types/<entity>.types.ts`)

- Mirror DB columns: `Entity` interface, `CreateEntityDto`, `UpdateEntityDto` (partial + is_active if applicable).
- No `any`; use `| null` where DB allows NULL.

### 4.3 Page component

- **State**: dialogOpen, editing | null, deleting | null, page, search, searchInput.
- **Query**: `useQuery({ queryKey: ['<entity>', listParams], queryFn: () => entityApi.getAll(listParams) })`.
- **Data**: `data?.data ?? []`, `data?.meta ?? null`.
- **Mutations**: create/update in one mutation (if editing then update else create); delete mutation. OnSuccess: invalidate `['<entity>']`, close dialog, toast.
- **Table**: `DataTableShell` with `serverSide`, `searchValue={searchInput}`, `onSearchChange`, `paginationMeta`, `onPageChange`, `isLoading`.
- **Forms**: `CrudFormDialog` with fields matching DTO; `initialData={editing}`; payload built from form data with correct number/boolean conversion.

---

## 5. Security Checklist

- [ ] `tenant_id` set only in controller from `req.tenantId` (JWT).
- [ ] No `tenant_id` in Joi schema or accepted from body.
- [ ] All queries filter by `tenant_id`.
- [ ] Whitelist of allowed update fields in service (no mass assignment).
- [ ] Parameterized queries only.

---

## 6. Example: Vendors (reference)

- **Backend**: `backend/src/modules/vendors/` (vendor.routes, controller, service, validation).
- **Frontend**: `frontend/src/api/vendorApi.ts`, `frontend/src/types/vendor.types.ts`, `frontend/src/pages/VendorsPage.tsx`.
- **App mount**: `app.use(\`${API}/vendors\`, vendorRoutes)`.

---

## 7. Applying to a New Table

1. Create `src/modules/<name>/` with routes, controller, service, validation (copy from vendors/customers and adapt table name, columns, Joi).
2. In `app.js`: require the routes and `app.use(\`${API}/<path>\`, <name>Routes)`.
3. Frontend: add types, api module, and page (copy VendorsPage/CustomersPage and replace entity names and fields).
4. Add route in React Router to the new page if needed.

---

## 8. Postman Examples (Vendors)

- **Base URL**: `{{baseUrl}}/api/v1` (set `baseUrl` in env).
- **Auth**: Header `Authorization: Bearer {{accessToken}}`.

| Method | URL | Body (example) |
|--------|-----|----------------|
| GET | /vendors?page=1&limit=25&search=acme&sortBy=name&sortOrder=ASC | — |
| GET | /vendors/:id | — |
| POST | /vendors | `{"name":"Acme Tiles","code":"VND-001","contact_person":"John","phone":"9876543210","email":"john@acme.com","gstin":"22AAAAA0000A1Z5","payment_terms_days":30,"is_active":true}` |
| PUT | /vendors/:id | `{"name":"Acme Tiles Ltd","is_active":true}` |
| DELETE | /vendors/:id | — (204) |

See `docs/postman/Vendors_CRUD.postman_collection.json` for importable collection.
