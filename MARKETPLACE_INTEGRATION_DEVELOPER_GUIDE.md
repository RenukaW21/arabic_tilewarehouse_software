# Marketplace Integration — Developer Guide

**Built:** 2026-06-02  
**Status:** Phase 1 Complete (Amazon skeleton ready · Flipkart & Meesho structure in place)  
**Base API Route:** `/api/v1/marketplace/*`  
**Frontend Base Route:** `/marketplace/*`

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Tables](#database-tables)
4. [Backend Modules](#backend-modules)
5. [Amazon SP-API Connector](#amazon-sp-api-connector)
6. [Frontend Pages](#frontend-pages)
7. [API Reference](#api-reference)
8. [Data Flow](#data-flow)
9. [Role & Access Control](#role--access-control)
10. [Pending Before Go-Live](#pending-before-go-live)

---

## Overview

The Marketplace Integration Module connects the Tiles WMS with three external sales platforms — **Amazon**, **Flipkart**, and **Meesho** — from a single centralized dashboard.

### What it does

| Feature | Direction | Description |
|---|---|---|
| Product listings | WMS → Platform | Push product catalog to each marketplace |
| Stock levels | WMS → Platform | Sync available quantity after every stock movement |
| Orders | Platform → WMS | Pull incoming marketplace orders into WMS |
| Pricing | WMS → Platform | Each platform has its own independent price per product |
| Shipment confirmation | WMS → Platform | Push tracking number back after dispatch |
| Returns | Platform → WMS | Pull return orders, trigger WMS stock reconciliation |
| Sync health | Internal | Per-platform connection status and sync history |

### Per-Platform Pricing

Each product has an independent price per platform stored in `marketplace_pricing`. A product can be priced at ₹1,260 on Amazon, ₹1,200 on Flipkart, and ₹1,140 on Meesho simultaneously. All price changes go through the existing **Admin Approval** workflow (`pricing_change` request type) before syncing to platforms.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  /marketplace/orders  /marketplace/pricing                      │
│  /marketplace/sync    /marketplace/credentials                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ Axios (JWT)
┌────────────────────────────▼────────────────────────────────────┐
│                     Backend (Express)                           │
│                                                                 │
│  marketplace-credentials  marketplace-pricing                   │
│  marketplace-orders       marketplace-returns                   │
│  marketplace-sync                                               │
│         │                                                       │
│         ▼                                                       │
│  connectors/amazon.js   (flipkart.js · meesho.js — planned)    │
│         │                                                       │
│         ▼                                                       │
│  External APIs: Amazon SP-API · Flipkart Seller API · Meesho   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Database (MariaDB)                           │
│  marketplace_credentials   marketplace_listings                 │
│  marketplace_pricing       marketplace_orders                   │
│  marketplace_returns       marketplace_sync_logs                │
└─────────────────────────────────────────────────────────────────┘
```

### Connector Layer

The connector (`backend/src/connectors/amazon.js`) sits between the service layer and the external API. It handles:
- LWA OAuth token exchange and refresh (Amazon)
- Authenticated SP-API requests
- Rate limit errors and retries

When Flipkart and Meesho connectors are built, they follow the same interface — the service layer calls the connector, not the platform API directly.

---

## Database Tables

All tables are **additive** — no existing table is modified.

### `marketplace_credentials`

Stores API keys and tokens per tenant per platform. Secrets are masked (replaced with `••••••••`) before being returned to the frontend.

| Column | Type | Description |
|---|---|---|
| `id` | varchar(36) | UUID primary key |
| `tenant_id` | varchar(36) | Tenant this credential belongs to |
| `platform` | enum | `amazon` / `flipkart` / `meesho` |
| `display_name` | varchar(100) | Human-readable store name |
| `seller_id` | varchar(255) | Seller account ID on the platform |
| `api_key` | text | API Key or Client ID (stored encrypted) |
| `api_secret` | text | API Secret or Client Secret |
| `access_token` | text | Short-lived OAuth access token |
| `refresh_token` | text | Long-lived OAuth refresh token |
| `token_expires_at` | datetime | When the access token expires |
| `marketplace_id` | varchar(100) | Platform marketplace ID (e.g. `A21TJRUUN4KGV` for Amazon India) |
| `fulfillment_type` | enum | `fbm` (self-ship) or `fba` (Amazon fulfils) — **Amazon only** |
| `is_active` | tinyint | Whether this platform connection is active |
| `last_sync_at` | datetime | Timestamp of last successful sync |

**Unique constraint:** One credential row per `(tenant_id, platform)`.

---

### `marketplace_listings`

Maps a WMS product to its listing ID on each platform.

| Column | Type | Description |
|---|---|---|
| `product_id` | varchar(36) | FK to `products.id` |
| `platform` | enum | Platform name |
| `platform_listing_id` | varchar(255) | ASIN / Flipkart listing ID / Meesho product ID |
| `platform_sku` | varchar(255) | Platform-side SKU |
| `status` | enum | `active` / `inactive` / `pending` / `error` |
| `sync_error` | text | Last sync error message if status = error |

---

### `marketplace_pricing`

Per-product, per-platform price overrides.

| Column | Type | Description |
|---|---|---|
| `product_id` | varchar(36) | FK to `products.id` |
| `platform` | enum | Platform name |
| `price` | decimal(10,2) | Price for this product on this platform |
| `updated_by` | varchar(36) | FK to `users.id` — who set this price |

**Unique constraint:** One price row per `(tenant_id, product_id, platform)`.

---

### `marketplace_orders`

Orders pulled from each marketplace.

| Column | Type | Description |
|---|---|---|
| `platform` | enum | Source platform |
| `platform_order_id` | varchar(255) | Order ID from the marketplace |
| `platform_order_date` | datetime | When the order was placed on the platform |
| `customer_name` | varchar(255) | Buyer name |
| `customer_email` | varchar(255) | Buyer email |
| `shipping_address` | text | Delivery address |
| `status` | enum | `pending` / `confirmed` / `shipped` / `delivered` / `cancelled` / `returned` |
| `total_amount` | decimal(10,2) | Order value |
| `currency` | varchar(10) | Default `INR` |
| `items` | longtext | JSON array of ordered items `[{ name, qty, price }]` |
| `tracking_number` | varchar(255) | Courier tracking number |
| `shipped_at` | datetime | When the order was marked shipped |
| `wms_sales_order_id` | varchar(36) | Linked WMS `sales_orders.id` once processed |
| `raw_payload` | longtext | Original full API response for audit |

**Unique constraint:** One row per `(tenant_id, platform, platform_order_id)` — prevents duplicate imports.

---

### `marketplace_returns`

Return orders pulled from each marketplace.

| Column | Type | Description |
|---|---|---|
| `platform` | enum | Source platform |
| `platform_return_id` | varchar(255) | Return ID from the marketplace |
| `marketplace_order_id` | varchar(36) | FK to `marketplace_orders.id` |
| `return_reason` | varchar(255) | Reason given by buyer |
| `return_quantity` | int | Number of items returned |
| `status` | enum | `initiated` / `received` / `restocked` / `rejected` |
| `items` | longtext | JSON array of returned items |
| `wms_return_id` | varchar(36) | Linked WMS `sales_returns.id` once processed |
| `restocked_at` | datetime | When stock was added back to WMS |

---

### `marketplace_sync_logs`

Audit trail for every sync run.

| Column | Type | Description |
|---|---|---|
| `platform` | enum | Which platform this sync was for |
| `sync_type` | enum | `orders` / `returns` / `listings` / `pricing` / `stock` |
| `status` | enum | `success` / `error` / `partial` |
| `records_in` | int | Records pulled from the platform |
| `records_out` | int | Records pushed to the platform |
| `error_msg` | text | Error details if status = error or partial |
| `started_at` | datetime | Sync start time |
| `finished_at` | datetime | Sync end time (null if still running) |

---

## Backend Modules

All modules live under `backend/src/modules/` and follow the standard pattern:
`repository.js → service.js → controller.js → routes.js`

### `marketplace-credentials`

Manages API credentials for each platform.

- `GET /marketplace/credentials` — list all configured platforms
- `GET /marketplace/credentials/:platform` — get credentials for a specific platform (secrets masked)
- `PUT /marketplace/credentials/:platform` — create or update credentials (upsert)
- `DELETE /marketplace/credentials/:id` — remove credentials

**Access:** Admin and Super Admin only.

Secret masking: `api_key`, `api_secret`, `access_token`, `refresh_token` are replaced with `••••••••` in all API responses. The raw values are only read internally by the connector layer.

---

### `marketplace-pricing`

Manages per-product, per-platform price overrides.

- `GET /marketplace/pricing` — list all pricing entries (filterable by platform, product_id)
- `POST /marketplace/pricing` — create or update a price (upsert by product + platform)
- `DELETE /marketplace/pricing/:productId/:platform` — remove a price override

The pricing data joins to `products` (for `name`, `code`) and `users` (for `updated_by_name`) in the list query.

---

### `marketplace-orders`

Manages orders imported from all marketplaces.

- `GET /marketplace/orders` — paginated list (filterable by platform, status, search)
- `GET /marketplace/orders/stats` — counts by status and platform
- `GET /marketplace/orders/:id` — single order with parsed `items` JSON
- `PATCH /marketplace/orders/:id/status` — update order status (confirm, ship, cancel)

When marking as `shipped`, the `tracking_number` and `shipped_at` fields are set at the same time.

---

### `marketplace-returns`

Manages return orders from all marketplaces.

- `GET /marketplace/returns` — paginated list (filterable by platform, status)
- `GET /marketplace/returns/:id` — single return with parsed `items` JSON
- `PATCH /marketplace/returns/:id/status` — update return status (received, restocked, rejected)

When marking as `restocked`, the `wms_return_id` and `restocked_at` fields are set to link back to the WMS sales return record.

---

### `marketplace-sync`

Provides sync health data and log history. Read-only — writes are done internally by the connector layer.

- `GET /marketplace/sync/health` — latest sync log per platform per type + credential status
- `GET /marketplace/sync/logs` — paginated full sync history (filterable by platform, sync_type)

---

## Amazon SP-API Connector

**File:** `backend/src/connectors/amazon.js`

### Authentication — LWA OAuth 2.0

Amazon SP-API uses **Login with Amazon (LWA)** OAuth. Access tokens expire every **1 hour**.

```
Refresh Token (long-lived, stored in marketplace_credentials)
    ↓
POST https://api.amazon.com/auth/o2/token
    ↓
Access Token (expires in 3600s)
    ↓
x-amz-access-token header on every SP-API request
```

Required credentials:
| Field | Where to get it |
|---|---|
| `api_key` (Client ID) | Amazon Seller Central → Apps & Services → Develop Apps |
| `api_secret` (Client Secret) | Same location as Client ID |
| `refresh_token` | Generated during SP-API app authorization flow |
| `marketplace_id` | `A21TJRUUN4KGV` for India (fixed) |
| `fulfillment_type` | Check Seller Central → Inventory → `FBA` or `FBM` label |

### Exported Functions

| Function | SP-API Endpoint | Notes |
|---|---|---|
| `getAccessToken(credentials)` | POST `/auth/o2/token` | Exchange refresh token for access token |
| `getOrders(credentials, createdAfter)` | GET `/orders/v0/orders` | Pull orders created after a given datetime |
| `getOrderItems(credentials, amazonOrderId)` | GET `/orders/v0/orders/:id/orderItems` | Get line items for a specific order |
| `updateFbmStock(credentials, sku, quantity)` | PUT `/listings/2021-08-01/items/:sellerId/:sku` | **FBM only** — push available stock qty |
| `confirmShipment(credentials, orderId, tracking, carrier)` | POST `/shipping/v2/shipments` | **FBM only** — confirm dispatch with tracking |
| `getReturns(credentials, createdAfter)` | GET `/mfn/v0/sellerInputParameters` | Pull buyer return requests (polling fallback) |

### FBM vs FBA — Critical Difference

| | FBM (Fulfilled by Merchant) | FBA (Fulfilled by Amazon) |
|---|---|---|
| Stock sync | Push available qty from WMS → Amazon after each sale | Push inbound shipment batches to Amazon FCA; Amazon manages qty |
| Shipment confirmation | WMS calls `confirmShipment` with tracking number | Amazon fulfils automatically — no action from WMS |
| Returns | Returns go back to seller's address | Returns go to Amazon FCA |

The `fulfillment_type` field in `marketplace_credentials` controls which code path runs. **This field must be set before activating any sync.**

---

## Frontend Pages

### `/marketplace/credentials` — Marketplace Credentials

**Access:** Admin, Super Admin only.

Shows exactly 3 fixed platform cards — Amazon, Flipkart, Meesho. Each card displays:
- Connection status badge (Connected / Not Connected)
- Configured display name, seller ID, fulfillment type
- Last sync timestamp
- Edit Credentials / Connect / Remove buttons

The credentials dialog shows the FBM/FBA fulfillment type selector **only for Amazon**.
Sensitive fields (API Key, Secret, Refresh Token) show `••••••••` once saved.

---

### `/marketplace/orders` — Marketplace Orders

**Access:** Admin, Super Admin, Warehouse Manager, Supervisor, Viewer.

Unified order inbox across all platforms with:
- **Stats bar** — Total, Pending, Confirmed, Shipped, Delivered, Cancelled, Returned counts
- **Filter bar** — Platform filter + Status filter + Search by order ID or customer name
- **Orders table** — Platform badge, Order ID, Customer, Date, Amount, Status badge, Tracking, Actions
- **Confirm action** — moves `pending` → `confirmed`
- **Ship action** — opens dialog to enter tracking number, moves `confirmed` → `shipped`

---

### `/marketplace/pricing` — Marketplace Pricing

**Access:** Admin, Super Admin, Warehouse Manager.

Displays all per-product per-platform price overrides with:
- Filter by platform
- Product name, code, platform badge, price, who updated it and when
- **Edit** — updates the price for that product+platform combination
- **Remove** — deletes the price override (product falls back to WMS base price)
- **+ Set Price** — opens dialog to assign a new platform price to any product

---

### `/marketplace/sync` — Sync Health

**Access:** Admin, Super Admin, Warehouse Manager.

Two sections:

**Health Cards** (one per platform):
- Connection status (Connected / Not Connected)
- Last sync timestamp
- Per-sync-type status badges (Orders: success, Stock: partial, Returns: error)

**Sync Log History table:**
- Full paginated history of all sync runs
- Columns: Platform, Type, Status, Records In, Records Out, Started, Finished, Error

---

## API Reference

### Credentials

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/v1/marketplace/credentials` | Admin | List all platform credentials (secrets masked) |
| GET | `/api/v1/marketplace/credentials/:platform` | Admin | Get one platform's credentials |
| PUT | `/api/v1/marketplace/credentials/:platform` | Admin | Create or update credentials |
| DELETE | `/api/v1/marketplace/credentials/:id` | Admin | Remove credentials |

### Pricing

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/v1/marketplace/pricing` | All auth | List pricing entries |
| POST | `/api/v1/marketplace/pricing` | Manager+ | Upsert a product+platform price |
| DELETE | `/api/v1/marketplace/pricing/:productId/:platform` | Admin | Remove a price entry |

### Orders

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/v1/marketplace/orders` | All auth | Paginated order list |
| GET | `/api/v1/marketplace/orders/stats` | All auth | Order counts by status + platform |
| GET | `/api/v1/marketplace/orders/:id` | All auth | Single order detail |
| PATCH | `/api/v1/marketplace/orders/:id/status` | Manager+ | Update order status |

### Returns

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/v1/marketplace/returns` | All auth | Paginated returns list |
| GET | `/api/v1/marketplace/returns/:id` | All auth | Single return detail |
| PATCH | `/api/v1/marketplace/returns/:id/status` | Manager+ | Update return status |

### Sync

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/v1/marketplace/sync/health` | Manager+ | Latest sync status per platform per type |
| GET | `/api/v1/marketplace/sync/logs` | Manager+ | Paginated full sync log history |

---

## Data Flow

### Order Import Flow (Platform → WMS)

```
1. Connector polls platform API (or receives webhook event)
2. For each new order:
   a. Check marketplace_orders for duplicate (platform + platform_order_id)
   b. If new → INSERT into marketplace_orders (status = 'pending')
   c. Create sync log entry
3. Warehouse manager sees order in /marketplace/orders inbox
4. Manager clicks "Confirm" → status = 'confirmed'
5. Manager picks and packs, clicks "Ship" → enters tracking number
   → status = 'shipped', tracking_number saved
   → Connector pushes tracking back to platform (FBM only)
6. Platform confirms delivery → status = 'delivered' (via webhook or polling)
```

### Return Flow (Platform → WMS)

```
1. Buyer initiates return on platform
2. Connector detects return event (webhook or polling)
3. INSERT into marketplace_returns (status = 'initiated')
4. Warehouse receives physical item
5. Manager marks return as 'received'
6. QC check:
   - Pass → mark 'restocked', create WMS sales_return record,
             stock added back via stock-adjustments module
   - Fail → mark 'rejected', no stock reconciliation
```

### Stock Sync Flow (WMS → Platform)

```
1. Any WMS operation that changes stock
   (GRN / stock-adjustment / sales-order dispatch)
   triggers a stock broadcast

2. For each connected platform where product has a listing:
   a. Read available qty from stock_summary
   b. Call platform connector updateStock(sku, qty)
   c. Log result in marketplace_sync_logs

FBM: Push actual available qty to Amazon/Flipkart/Meesho
FBA: Only update inbound shipment quantities to Amazon FCA
     (Amazon manages the customer-facing available qty internally)
```

### Pricing Sync Flow (WMS → Platform)

```
1. Admin sets/updates a price in /marketplace/pricing
2. A pricing_change approval request is automatically submitted
3. Admin approves the request in /admin/approvals
4. On approval → connector pushes new price to the platform
5. Sync log entry written
```

---

## Role & Access Control

| Role | Credentials | Orders | Pricing | Sync Health |
|---|---|---|---|---|
| super_admin | Full access | Full access | Full access | Full access |
| admin | Full access | Full access | Full access | Full access |
| warehouse_manager | No access | View + Update status | View + Set prices | View |
| supervisor | No access | View + Update status | View only | No access |
| viewer | No access | View only | View only | No access |
| accountant | No access | No access | No access | No access |
| sales | No access | No access | No access | No access |

---

## Pending Before Go-Live

### Must confirm with client

| Item | Impact |
|---|---|
| **Amazon FBM vs FBA** | Controls stock sync logic and shipment confirmation flow entirely |
| **Active seller accounts** | Real API credentials needed to test against live sandboxes |

### Must build before activating sync

| Item | Notes |
|---|---|
| Stock sync trigger | Hook into GRN / stock-adjustments / sales-order dispatch to call connector |
| Approval → sync bridge | Wire `pricing_change` approval → connector price push |
| Flipkart connector | `backend/src/connectors/flipkart.js` — Phase 2 |
| Meesho connector | `backend/src/connectors/meesho.js` — Phase 3 |
| Webhook receivers | Replace polling with real-time platform push events (Phase 3) |
| Cron / scheduler | Periodic polling job for order pull and stock push (until webhooks are live) |

### Nice to have (Phase 3+)

- Marketplace performance reporting in the existing reports module
- Email/push notifications on sync failure
- Multi-channel oversell guard — auto-pause listings when WMS stock hits reorder level
- Automated FBA inbound shipment creation

---

## Key Files

### Backend

| File | Purpose |
|---|---|
| `backend/src/modules/marketplace-credentials/` | Credential management module |
| `backend/src/modules/marketplace-pricing/` | Per-platform pricing module |
| `backend/src/modules/marketplace-orders/` | Order inbox module |
| `backend/src/modules/marketplace-returns/` | Returns module |
| `backend/src/modules/marketplace-sync/` | Sync health and logs module |
| `backend/src/connectors/amazon.js` | Amazon SP-API connector |
| `backend/src/app.js` | Route registrations (`/marketplace/*`) |
| `backend/database/schema.sql` | All 6 new table DDL statements |

### Frontend

| File | Purpose |
|---|---|
| `frontend/src/api/marketplaceApi.ts` | Typed Axios API client for all marketplace endpoints |
| `frontend/src/pages/marketplace/MarketplaceCredentialsPage.tsx` | Credentials configuration UI |
| `frontend/src/pages/marketplace/MarketplaceOrdersPage.tsx` | Unified orders inbox |
| `frontend/src/pages/marketplace/MarketplacePricingPage.tsx` | Per-platform pricing management |
| `frontend/src/pages/marketplace/MarketplaceSyncPage.tsx` | Sync health dashboard |
| `frontend/src/App.tsx` | Route registrations for all 4 marketplace pages |
| `frontend/src/components/layout/AppSidebar.tsx` | Marketplace nav group |

---

*Documentation generated 2026-06-02 — Marketplace Integration Module, Phase 1.*
