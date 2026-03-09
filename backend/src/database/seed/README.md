# Tiles WMS — Database Seed

Production-like dummy data for all tenant-scoped tables. Multi-tenant safe; FK order respected.

## Run

```bash
cd backend
npm run seed
```

Requires `.env` with DB credentials (same as app). Optional:

- `SEED_PASSWORD` — Password for seeded users (default: `Seed@123`).
- `FORCE_SEED=1` — Run even if seed tenants already exist (will duplicate tenants if run again; use with care).

## Execution order (FK-safe)

1. **Tenants** (2): Tiles India Pvt Ltd, Ceramic World Distributors  
2. **Per tenant:**
   - Users (4): Admin, Warehouse Manager, Sales, Accountant  
   - GST configuration (1)  
   - Warehouses (2)  
   - Racks (8 per warehouse)  
   - Vendors (10)  
   - Customers (10)  
   - Product categories (4): Floor, Wall, Outdoor, Premium  
   - Products (20) with sizes, HSN, GST, MRP  
   - Shades (2 per product)  
   - Batches (1 per product, linked to vendor)  
   - Document counters (PO, GRN, SO, INV, CN, DN, CP, VP, TR, SR, PR)  
   - Purchase orders (3) + items  
   - GRN (2) + items  
   - Stock summary (10 rows)  
   - Stock ledger (opening entries)  
   - Sales orders (4) + items  
   - Invoices (2) + items  
   - Customer payments (2)  
   - Vendor payments (2)  
   - Notifications (2)  

All inserts run in a **single transaction**; on error, nothing is committed.

## Login after seed

| Tenant        | Admin email           | Password   |
|---------------|------------------------|------------|
| Tiles India   | admin@tilesindia.com   | Seed@123   |
| Ceramic World | admin@ceramicworld.in  | Seed@123   |

(Other users: warehouse@..., sales@..., accountant@... with same domain and password.)

## Duplicate prevention

If tenants with slugs `tiles-india` or `ceramic-world` already exist, the seed exits without inserting. Set `FORCE_SEED=1` to run anyway (can create duplicate tenant data).

## Files

- `fixtures.js` — Realistic data (company names, GSTINs, products, etc.).
- `seed-runner.js` — Insert logic in FK order; transaction and logging.
- Entry: `src/config/seed.js` (used by `npm run seed`).
