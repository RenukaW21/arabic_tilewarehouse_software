# Marketplace Integration Module

**Status:** Planned  
**Route (Backend):** `/api/v1/marketplace`  
**Audience:** Admin, Super Admin (configuration) · Warehouse Manager, Operations (order management)

---

## What the Client Requires

> "This integration connects the system with Flipkart, Meesho, and Amazon to automatically synchronize product listings, inventory stock, orders, shipping details, pricing, and returns. It helps manage all marketplace operations directly from a centralized dashboard."

In plain terms:
- **One dashboard** to manage sales across Flipkart, Meesho, and Amazon simultaneously.
- **Bidirectional sync** — WMS pushes catalog/stock/pricing out; marketplaces push orders/returns in.
- **Stock stays consistent** across all channels — a sale on one platform reduces available stock visible to all others.
- **Each platform has its own independent price** — a product can be priced differently on Amazon, Flipkart, and Meesho.
- **Pricing and listing changes** go through the existing Admin Approval workflow before publishing.
- **Returns are in scope from Phase 1** — return orders must trigger stock reconciliation in WMS.

---

## Confirmed Decisions (2026-06-02)

| Decision | Answer |
|---|---|
| Platform priority order | Amazon → Flipkart → Meesho |
| Per-platform pricing | Yes — each platform has its own independent price per product |
| Returns handling | Yes — in scope from Phase 1 (Amazon), not deferred |
| Seller accounts active? | Unknown — to confirm with client before API integration testing |
| Amazon FBA vs FBM? | **Pending — must confirm before finalizing Amazon Phase 1 design** |

---

## Platform Coverage

### Phase 1 — Amazon Integration
Covers Amazon Seller Central (SP-API):

| Feature | Direction | Description |
|---|---|---|
| Product Listings | Push (WMS → Amazon) | Sync catalog — title, images, specs, categories |
| Stock Levels | Push (WMS → Amazon) | Push available quantity after every WMS stock movement |
| Order Processing | Pull (Amazon → WMS) | Import Amazon orders automatically into WMS |
| Pricing | Push (WMS → Amazon) | Sync Amazon-specific price (via approval workflow) |
| Shipment Updates | Push (WMS → Amazon) | Push tracking/fulfillment confirmation back to Amazon |
| Returns | Pull (Amazon → WMS) | Import Amazon return orders, trigger stock reconciliation |

### Phase 2 — Flipkart Integration
Covers the full operational surface of a Flipkart seller account:

| Feature | Direction | Description |
|---|---|---|
| Product Listings | Push (WMS → Flipkart) | Sync catalog — title, images, specs, categories |
| Inventory Stock | Push (WMS → Flipkart) | Push available quantity after every WMS stock movement |
| Orders | Pull (Flipkart → WMS) | Import incoming Flipkart orders automatically |
| Shipping Details | Push (WMS → Flipkart) | Push shipment and tracking info back to Flipkart |
| Pricing | Push (WMS → Flipkart) | Sync Flipkart-specific price (via approval workflow) |
| Returns | Pull (Flipkart → WMS) | Handle return orders, trigger WMS stock reconciliation |

### Phase 3 — Meesho Integration
Focused on the Meesho reseller marketplace:

| Feature | Direction | Description |
|---|---|---|
| Order Management | Pull (Meesho → WMS) | Auto-import Meesho orders into WMS |
| Inventory Sync | Push (WMS → Meesho) | Push available quantity after every WMS stock movement |
| Product Updates | Push (WMS → Meesho) | Keep catalog in sync with Meesho listings |
| Shipment Tracking | Push (WMS → Meesho) | Push tracking updates back to Meesho |
| Pricing | Push (WMS → Meesho) | Sync Meesho-specific price (via approval workflow) |
| Returns | Pull (Meesho → WMS) | Handle return orders, trigger WMS stock reconciliation |

---

## Architectural Overview

### Components Needed

1. **Marketplace Connector Services** — one per platform
   - Amazon SP-API (OAuth 2.0 with LWA — most complex, done first)
   - Flipkart Seller API (REST, API key auth)
   - Meesho Seller API (REST, API key auth)
   - Handles: authentication, token refresh, rate limiting, retry logic, error handling

2. **Sync Engine** — shared bidirectional layer
   - Push queue: WMS changes → marketplace (catalog, stock, pricing)
   - Pull queue: marketplace events → WMS (orders, returns, cancellations)
   - Conflict resolution: last-write-wins with audit log

3. **Per-Platform Pricing Model**
   - Each product has a base WMS price + optional override per platform
   - Stored in `marketplace_pricing` table (product_id + platform + price)
   - Price changes go through `pricing_change` approval request before sync

4. **Returns Handler**
   - Accepts return events from each platform
   - Creates a `sales_returns` record in the existing sales-returns module
   - Triggers stock reconciliation (stock added back to WMS inventory)
   - Logs return reason, quantity, condition

5. **Stock Reconciliation Layer**
   - When a sale occurs on any platform, deduct from master WMS stock
   - Broadcast updated available quantity to all other connected platforms
   - Prevents overselling across channels

6. **Webhook Receivers** — real-time push events
   - Order placed, order cancelled, return initiated, payment confirmed
   - Amazon SNS notifications + Flipkart/Meesho webhook callbacks
   - Phase 1 can use polling; webhooks replace polling in Phase 2+

7. **Marketplace Orders UI** — unified order inbox
   - All orders from connected platforms in one table
   - Filter by platform, status, date
   - Actions: process, ship, cancel, view return

8. **Sync Status / Health Dashboard** — per-platform health panel
   - Connection status (connected / disconnected / error)
   - Last successful sync timestamp
   - Error log with retry option
   - Items pending sync count

9. **Credential Management** — per-tenant, per-platform
   - Secure storage of API keys, Client ID/Secret, Refresh tokens
   - Admin-only configuration page

---

## Integration with Existing Modules

### Admin Approval Workflow
The `approval_requests` table already has two relevant `request_type` values:
- `marketplace_update` — any product listing change must be approved before publishing
- `pricing_change` — any price update must be approved before syncing to any platform

This means: **no listing or price change goes live on any marketplace without admin approval first.**

### Sales Returns Module
Return orders from any marketplace will create a record in the existing `sales-returns` module — keeping return history unified whether the order came from a marketplace or a direct sale.

### Stock Adjustments
Every marketplace sale deducts from WMS stock via the stock-adjustments flow. Returns that restore stock also route through the same module for a clean audit trail.

### Products Module
The products catalog is the source of truth for all marketplace listings. Any product update on catalog-visible fields triggers an `approval_request` before propagating to marketplace connectors.

### Reports Module
Marketplace sales, returns, and revenue feed into the existing reporting structure (GST / Revenue reports).

---

## Database Design (Planned)

### New Tables

| Table | Purpose |
|---|---|
| `marketplace_credentials` | Per-tenant, per-platform API keys / tokens (encrypted) |
| `marketplace_listings` | Mapping of WMS product → marketplace listing ID per platform |
| `marketplace_pricing` | Per-product, per-platform price overrides |
| `marketplace_orders` | Orders pulled from each marketplace, linked to WMS sales order |
| `marketplace_returns` | Return orders pulled from each marketplace, linked to WMS sales return |
| `marketplace_sync_logs` | Per-sync audit trail: what was synced, status, error details |
| `marketplace_webhooks` | Incoming webhook event log for audit and replay |

**No existing table is altered.**

### Key: `marketplace_pricing` table
```sql
CREATE TABLE `marketplace_pricing` (
  `id`          varchar(36) NOT NULL,
  `tenant_id`   varchar(36) NOT NULL,
  `product_id`  varchar(36) NOT NULL,
  `platform`    enum('amazon','flipkart','meesho') NOT NULL,
  `price`       decimal(10,2) NOT NULL,
  `updated_by`  varchar(36) NOT NULL,
  `updated_at`  datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_product_platform` (`tenant_id`, `product_id`, `platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Key Complexity Points

| Area | Complexity | Notes |
|---|---|---|
| Amazon SP-API auth | High | LWA OAuth with token rotation; must resolve FBA vs FBM first |
| Per-platform pricing | Medium | Separate price per product per platform; all changes approval-gated |
| Returns in Phase 1 | Medium | Must wire into existing sales-returns module + stock reconciliation |
| Multi-channel stock consistency | High | Sale on one platform must update available qty on all others |
| Rate limiting | Medium | Each platform has API call quotas; sync engine must queue and throttle |
| Webhook security | Medium | Verify platform signatures before processing events |

---

## Phasing (Confirmed)

### Phase 1 — Amazon (Full Depth)
- Credential management UI (admin only) — foundation for all platforms
- Amazon SP-API connector (auth, token refresh, rate limiting)
- Product listing sync → Amazon
- Stock sync → Amazon (after every WMS stock movement)
- Per-platform pricing (Amazon price per product, approval-gated)
- Order pull → WMS (Amazon orders → `marketplace_orders` → `sales_orders`)
- Shipment push → Amazon (tracking/fulfillment confirmation)
- **Returns** — pull Amazon return orders → `sales_returns` + stock reconciliation
- Sync health dashboard (Amazon connection status, error log, last sync)

> **Blocker before Phase 1 build starts:** Confirm Amazon FBM (self-ship) or FBA (Amazon fulfils). This changes stock sync and fulfillment logic significantly.

### Phase 2 — Flipkart (Replicate the Pattern)
- Flipkart API connector
- Full feature set: listings, stock, orders, pricing, shipping, returns
- Multi-channel stock guard activated (Amazon + Flipkart stock now shared)

### Phase 3 — Meesho + Full Automation
- Meesho API connector
- Full feature set: orders, inventory, products, pricing, tracking, returns
- Multi-channel stock guard extended (all 3 platforms)
- Webhooks replace polling for real-time order/return events
- Marketplace performance reporting in reports module
- Sync failure notifications (in-app → email in later phase)

---

## Open Questions (Remaining)

| Question | Status | Impact |
|---|---|---|
| Amazon FBA vs FBM? | **Must confirm** | Changes stock sync + fulfillment logic for entire Phase 1 |
| Seller accounts active on all 3 platforms? | Unknown — confirm with client | Needed for API sandbox testing; does not block UI/backend build |
| Promotions / coupons in scope? | Not confirmed | Treat as out of scope until client raises it |

---

*Added 2026-06-02 — Confirmed decisions updated 2026-06-02 based on client discussion.*
