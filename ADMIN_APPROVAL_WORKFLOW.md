# Admin Approval Workflow Module

**Built:** 2026-05-29
**Route (Backend):** `/api/v1/approval-requests`
**Frontend URL:** `/admin/approvals`
**Audience:** Admin, Super Admin (reviewers) · All operational roles (submitters)

---

## What the Client Requires

> "This module ensures that all important operational processes such as production entries, inventory adjustments, purchase approvals, pricing changes, marketplace updates, and report validations are first reviewed and approved by the Admin before execution. It provides role-based authorization, approval tracking, and audit history for secure business operations."

In plain terms:
- **No critical operation executes instantly** — it sits in a queue as `pending`.
- **Only Admin (or Super Admin) can approve or reject** items from the queue.
- **Every decision is logged** — who submitted, who reviewed, when, and with what notes.
- The system covers six operation types: production entries, inventory adjustments, purchase approvals, pricing changes, marketplace updates, and report validations.

---

## Clarifications & Design Decisions

### 1. Single approval tier
There is one approver tier: `admin` and `super_admin`. No multi-level escalation (Manager → Admin) is needed based on the stated requirement. This can be extended later.

### 2. Rejected requests are closed, not editable
When an Admin rejects a request, the submitter must create a new corrected entry. The rejected record is kept as an immutable audit trail.

### 3. Notifications are in-app only (Phase 1)
The existing `notifications` table is used to push an in-app notification when a request is submitted (to admins) and when it is approved/rejected (back to submitter). Email notifications are a Phase 2 enhancement.

### 4. The `approval_requests` table is additive
No existing table is modified. The new table references existing records by `reference_id` + `reference_type`, keeping the existing module schemas intact.

### 5. Execution on approval is deferred to the module owning the operation
When an admin approves a request, the service calls the appropriate module's execution function (e.g., `stockAdjustmentsService.approve()`). This keeps the approval module thin and the business logic in the correct owner module.

### 6. Stock adjustments already had a `pending → approved` flow
The existing flow was gated at `warehouse_manager` level. Under this requirement, the approve action is elevated to `admin` level — a tightening of security, not a breaking change. Warehouse managers can still create adjustments; only admins can approve them.

---

## Operation Types Covered

| Type Key | Operation | Existing Module | Trigger |
|---|---|---|---|
| `inventory_adjustment` | Stock add/deduct corrections | `stock-adjustments` | Create stock adjustment |
| `production_entry` | Start/complete a production order | `production-orders` | Status change to `in_progress` or `completed` |
| `purchase_approval` | Confirm a purchase order | `purchase-orders` | Confirm PO |
| `pricing_change` | Update product price / size / specs | `products` | PUT on price-sensitive fields |
| `marketplace_update` | Update product listing info | `products` | PUT on catalog-visible fields |
| `report_validation` | Finalize/export an accounting report | `reports` | Export action for GST / Revenue |

---

## Database Design

### New Table: `approval_requests`

```sql
CREATE TABLE `approval_requests` (
  `id`             varchar(36) NOT NULL,
  `tenant_id`      varchar(36) NOT NULL,
  `request_type`   enum('inventory_adjustment','production_entry','purchase_approval',
                        'pricing_change','marketplace_update','report_validation') NOT NULL,
  `reference_id`   varchar(36) NOT NULL,
  `reference_type` varchar(50) NOT NULL,
  `title`          varchar(255) NOT NULL,
  `description`    text DEFAULT NULL,
  `payload`        longtext DEFAULT NULL,
  `status`         enum('pending','approved','rejected') DEFAULT 'pending',
  `submitted_by`   varchar(36) NOT NULL,
  `reviewed_by`    varchar(36) DEFAULT NULL,
  `submitted_at`   datetime DEFAULT current_timestamp(),
  `reviewed_at`    datetime DEFAULT NULL,
  `review_notes`   text DEFAULT NULL,
  `created_at`     datetime DEFAULT current_timestamp(),
  `updated_at`     datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status`  (`tenant_id`, `status`),
  KEY `idx_tenant_type`    (`tenant_id`, `request_type`),
  KEY `idx_submitted_by`   (`submitted_by`),
  KEY `idx_reviewed_by`    (`reviewed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

**No existing table is altered.**

---

## Backend API

**Base:** `GET|POST /api/v1/approval-requests`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/approval-requests` | All authenticated | List requests (admins see all; others see own) |
| `GET` | `/approval-requests/stats` | admin, super_admin | Counts by status and type |
| `GET` | `/approval-requests/:id` | All authenticated | Detail view |
| `POST` | `/approval-requests` | All operational roles | Submit a new request |
| `POST` | `/approval-requests/:id/approve` | admin, super_admin | Approve + execute |
| `POST` | `/approval-requests/:id/reject` | admin, super_admin | Reject with notes |

### Request Body — POST `/approval-requests`

```json
{
  "request_type": "inventory_adjustment",
  "reference_id": "uuid-of-the-stock-adjustment",
  "reference_type": "stock_adjustment",
  "title": "Add 50 boxes — Vitrified Premium 600x600 (Main WH)",
  "description": "Received damaged stock that was restocked after QC pass.",
  "payload": { ... }
}
```

### Response — GET `/approval-requests`

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": "uuid",
        "request_type": "inventory_adjustment",
        "title": "Add 50 boxes ...",
        "status": "pending",
        "submitted_by": "uuid",
        "submitter_name": "Ravi Kumar",
        "reviewed_by": null,
        "reviewer_name": null,
        "submitted_at": "2026-05-29T10:00:00Z",
        "reviewed_at": null,
        "review_notes": null
      }
    ],
    "total": 12,
    "pending": 5,
    "approved": 6,
    "rejected": 1
  }
}
```

---

## Frontend Page — `/admin/approvals`

**Access:** `super_admin`, `admin` only

### Layout
1. **Stats bar** — 4 KPI cards: Total, Pending, Approved, Rejected
2. **Filter bar** — Status filter (All / Pending / Approved / Rejected) + Type filter + Search by title
3. **Requests table** — columns: Title, Type badge, Status badge, Submitted By, Date, Actions
4. **Approve / Reject modal** — inline confirmation with optional review notes text area
5. **History view** — clicking a row expands to show full payload and audit trail

### Role visibility
- `admin` / `super_admin` → see all requests + approve/reject buttons
- All other roles → see only their own submissions + read-only status

---

## Audit Trail

Every approval or rejection is captured:
- `reviewed_by` — the admin's user ID
- `reviewed_at` — timestamp
- `review_notes` — admin's comment
- The existing `audit_logs` table gets an entry via `auditLog.js` for both submit and review actions

---

## Files Changed or Created

### New Files

| File | Purpose |
|---|---|
| `backend/src/modules/approval-requests/repository.js` | DB queries |
| `backend/src/modules/approval-requests/service.js` | Business logic, approve/reject execution |
| `backend/src/modules/approval-requests/controller.js` | HTTP handlers |
| `backend/src/modules/approval-requests/routes.js` | Route definitions + role guards |
| `backend/src/modules/approval-requests/validation.js` | Joi schemas |
| `frontend/src/api/approvalApi.ts` | Axios API client |
| `frontend/src/pages/ApprovalRequestsPage.tsx` | Admin approval dashboard page |

### Modified Files

| File | Change |
|---|---|
| `backend/database/schema.sql` | Added `approval_requests` table DDL |
| `backend/src/app.js` | Registered `/approval-requests` route |
| `backend/src/modules/stock-adjustments/routes.js` | Elevated approve role from `warehouse_manager` → `admin` |
| `frontend/src/App.tsx` | Added `/admin/approvals` route with RoleGuard |
| `frontend/src/components/layout/AppSidebar.tsx` | Added "Approvals" nav item under Setup/Admin with pending badge |
| `frontend/src/components/layout/DashboardLayout.tsx` | Added page title entry |
| `frontend/src/locales/en.json` | Added `nav.approvals` + `approvals.*` section |
| `frontend/src/locales/ar.json` | Same keys in Arabic |

---

## Non-Breaking Guarantee

- All existing API endpoints remain on the same paths with the same behavior.
- No existing table schema is modified — `approval_requests` is purely additive.
- The stock-adjustments `approve` endpoint changes its role guard from `warehouse_manager` to `admin`. Warehouse managers lose the ability to self-approve adjustments — this is the **intended security tightening** per the client requirement, not an accidental regression.
- Existing data is unaffected.

---

## Known Limitations (Phase 1)

| Limitation | Future Enhancement |
|---|---|
| No email/push notification on approval/rejection | Add email via NodeMailer in Phase 2 |
| Execution-on-approval only implemented for `inventory_adjustment` | Wire other types as their modules mature |
| No SLA / expiry on pending requests | Add `expires_at` column + cron job alert |
| No "return for correction" flow | Submitter must re-create; rejected record remains read-only |

---

*Generated as part of the Tiles WMS feature implementation — 2026-05-29*
