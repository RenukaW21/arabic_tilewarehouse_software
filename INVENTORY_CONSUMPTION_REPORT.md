# Inventory Consumption Report — Feature Documentation

**Built:** 2026-05-28
**Module:** Reports → Inventory Consumption
**Route:** `GET /reports/inventory-consumption` · `GET /reports/inventory-consumption/export`
**Frontend URL:** `/reports/inventory-consumption`
**Audience:** Accounting, Auditing, Warehouse Management

---

## Why We Built This

The warehouse system already tracked every stock movement through the `stock_ledger` table — every GRN, sale dispatch, production material consumed, transfer out, damage write-off, and adjustment. The data was there. But there was no single place where a manager, accountant, or auditor could see:

> *"Which items did we consume, in what quantity, at what cost, and through what type of movement — for any date range I choose?"*

Existing reports answered different questions:
- **GST Report** → tax liability per invoice period
- **Revenue Report** → sales income trends
- **Aging Report** → unpaid receivables
- **Stock Valuation** → current inventory value at rest

None of them answered the **consumption** question — the outward flow of stock with pricing context. This created three problems in practice:

1. **Accounting** could not reconcile cost of goods consumed per period without manually pulling ledger records and joining product cost data in a spreadsheet.
2. **Auditors** had no single trail showing what left the warehouse, why, and what it was worth at the time.
3. **Management** had no visibility into which movement type (production, sales, damage, transfer) was the dominant driver of stock reduction — critical for loss analysis and production planning.

This module closes that gap.

---

## What It Does

The Inventory Consumption Report aggregates all **outward stock movements** from `stock_ledger` (where `boxes_out > 0`) and enriches each record with:

- Product name, code, HSN code, size label
- Warehouse name
- Movement type (sale, damage, adjustment, transfer out, production material)
- Quantity consumed in boxes and sqft
- Unit cost from `stock_summary.avg_cost_per_box`
- Calculated total value = `qty_consumed × unit_cost`
- Running balance after the movement

The report can be filtered, viewed in-browser with live aggregation, and downloaded as a formatted Excel file for offline analysis.

---

## Files Changed or Created

### Backend

| File | Type | What Changed |
|------|------|--------------|
| `backend/src/modules/reports/service.js` | Modified | Added `getInventoryConsumptionReport()` and `exportInventoryConsumptionExcel()` |
| `backend/src/modules/reports/controller.js` | Modified | Added `inventoryConsumption` and `inventoryConsumptionExport` handlers |
| `backend/src/modules/reports/routes.js` | Modified | Added two new GET routes with role guard |
| `backend/package.json` | Modified | `exceljs` installed as a dependency |

### Frontend

| File | Type | What Changed |
|------|------|--------------|
| `frontend/src/api/reportApi.ts` | Modified | Added `getInventoryConsumption()` and `exportInventoryConsumption()` |
| `frontend/src/pages/InventoryConsumptionReportPage.tsx` | **New** | Main report page |
| `frontend/src/App.tsx` | Modified | Import + route `/reports/inventory-consumption` |
| `frontend/src/components/layout/AppSidebar.tsx` | Modified | Nav item under Reports + `TrendingDown` icon import |
| `frontend/src/components/layout/DashboardLayout.tsx` | Modified | Page title entry |
| `frontend/src/locales/en.json` | Modified | `nav.consumption` key + full `consumptionReport` section |
| `frontend/src/locales/ar.json` | Modified | Same keys in Arabic |

---

## Architecture Decisions

### 1. Why pull from `stock_ledger` and not `stock_summary`

`stock_summary` holds the **current** balance per product-warehouse-shade-batch bin. It answers "what do we have now" but cannot answer "what did we consume over a time range." Only `stock_ledger` has the full transactional history with dates, quantities, and movement types. The report queries `stock_ledger` directly with date and type filters.

### 2. Why unit cost comes from `stock_summary.avg_cost_per_box` and not the ledger

The `stock_ledger` table stores movement quantities and balances but does not store the unit cost at the time of movement. The closest reliable cost signal available is `avg_cost_per_box` from `stock_summary`, which reflects the weighted average cost of the current stock. This is the same value the stock valuation report uses. The limitation — that it reflects current cost, not historical cost at the moment of each movement — is acknowledged and documented here. A future enhancement could capture unit cost into the ledger at write time (e.g. via `stockHelper.postStockMovement`).

### 3. Why the subquery for `avg_cost_per_box` instead of a direct JOIN

A product can exist across multiple shades and batches within one warehouse, meaning `stock_summary` can have many rows for the same `(product_id, warehouse_id)`. A direct LEFT JOIN would produce one ledger row per summary bin — multiplying rows and inflating totals. The subquery `AVG(avg_cost_per_box) GROUP BY product_id, warehouse_id` collapses these into a single cost per product-warehouse pair before joining, so each ledger row maps to exactly one cost row.

```sql
LEFT JOIN (
  SELECT product_id, warehouse_id, AVG(avg_cost_per_box) AS avg_cost
  FROM   stock_summary
  WHERE  tenant_id = ?
  GROUP  BY product_id, warehouse_id
) cost ON cost.product_id = sl.product_id AND cost.warehouse_id = sl.warehouse_id
```

### 4. Why Excel export is server-side (not browser-side)

The frontend already has `jspdf` installed but PDF is inappropriate for accounting data — accountants need to edit, sort, and pivot in Excel. Browser-side Excel generation (e.g. SheetJS) would require bundling a large dependency and generating the file entirely from JavaScript with the full data payload already in memory. Server-side generation with `exceljs` is cleaner:

- The styling (merged cells, colored headers, borders, number formats) is applied in Node where performance is not a concern
- The browser downloads a stream — no large blob held in JS memory
- Auth is enforced on the export endpoint (same role guard as the JSON endpoint)
- The file name is stamped with today's date automatically

The frontend calls the endpoint with `responseType: 'blob'` via axios, then uses a temporary anchor element to trigger the browser's native download — no third-party library needed on the frontend side.

### 5. Why `production_material` is included by default

When the production module was built, it writes to `stock_ledger` with `transaction_type = 'production_material'` whenever a production order is completed and raw materials are deducted. This is exactly the "production cost" consumption the client requirement called for. Including it in the default movement types means the report shows a complete picture of stock going out — whether through sales, production, damage, or transfers — without requiring the user to select it manually.

The five default movement types included are:
- `sale` — stock dispatched against a sales order
- `damage` — write-offs recorded in damage entries
- `adjustment` — manual adjustment entries (OUT direction)
- `transfer_out` — stock transferred to another warehouse
- `production_material` — raw materials consumed in production orders

### 6. Why the search filter is client-side

Date, warehouse, and transaction type filters are applied at the database query level because they can reduce result size significantly before any data is sent to the browser. Product name/code search is applied client-side because:
- It operates on data already fetched and rendered
- Products are searched interactively (character by character) — a network round-trip per keystroke would be too slow
- Warehouse-scoped consumption reports are typically not large enough to need server-side text search

---

## API Reference

### GET `/reports/inventory-consumption`

Returns the JSON report data.

**Auth:** Required. Roles: `super_admin`, `admin`, `accountant`, `warehouse_manager`, `viewer`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | `YYYY-MM-DD` | Start of date range (inclusive) |
| `to` | `YYYY-MM-DD` | End of date range (inclusive) |
| `productId` | `string` | Filter to a single product ID |
| `warehouseId` | `string` | Filter to a single warehouse ID |
| `transactionType` | `string` | One of: `sale`, `damage`, `adjustment`, `transfer_out`, `production_material` |

**Response shape:**

```json
{
  "success": true,
  "message": "Inventory consumption report",
  "data": {
    "summary": {
      "totalQtyConsumed": 1240.50,
      "totalSqftConsumed": 13329.75,
      "totalValue": 987654.00,
      "uniqueProducts": 18,
      "totalRows": 312
    },
    "rows": [
      {
        "id": 1,
        "transaction_date": "2026-05-20T00:00:00.000Z",
        "transaction_type": "sale",
        "reference_id": 42,
        "reference_type": "sales_order",
        "qty_consumed": 120,
        "sqft_consumed": 1290.0,
        "balance_boxes": 880,
        "notes": null,
        "product_id": 7,
        "product_name": "Vitrified Premium 600x600",
        "product_code": "VIT-600",
        "hsn_code": "6907",
        "size_label": "600x600",
        "warehouse_id": 1,
        "warehouse_name": "Main Warehouse",
        "unit_cost": 280.00,
        "total_value": 33600.00
      }
    ]
  }
}
```

---

### GET `/reports/inventory-consumption/export`

Streams a formatted `.xlsx` file directly to the browser.

**Auth:** Same role guard as above.

**Query Parameters:** Same as the JSON endpoint.

**Response:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
**Content-Disposition:** `attachment; filename="inventory-consumption-YYYY-MM-DD.xlsx"`

---

## Excel File Structure

The exported workbook (`inventory-consumption-YYYY-MM-DD.xlsx`) contains one worksheet — **Consumption Report** — structured as follows:

| Row | Content |
|-----|---------|
| 1 | Title banner — "Inventory Consumption Report" (merged, dark blue background) |
| 2 | Applied filters summary (date range, type) in italic |
| 3 | *(blank)* |
| 4–5 | KPI block — 5 summary metrics side by side (Total Qty, Sqft, Value, Unique Products, Entries) |
| 6 | *(blank)* |
| 7 | Column headers row (dark navy background, white bold text) |
| 8+ | Data rows (alternating white/light-blue background, formatted numbers) |
| Last | Totals row (indigo background, bold) |

**Columns:**

| # | Column | Format |
|---|--------|--------|
| A | Row number | Integer |
| B | Date | `dd/mm/yyyy` (locale-formatted) |
| C | Product Code | Text |
| D | Product Name | Text |
| E | Warehouse | Text |
| F | Movement Type | Text |
| G | Qty Consumed (boxes) | `#,##0.##` |
| H | Sqft Consumed | `#,##0.##` |
| I | Unit Cost (₹) | `₹#,##0.00` |
| J | Total Value (₹) | `₹#,##0.00` |

---

## Frontend UI Components

### Filters Bar
- **From Date / To Date** — native `<input type="date">` — applied at the API query level
- **Movement Type** — `<select>` with all five OUT types + "All" option
- **Search** — free-text, client-side, matches product name and product code
- **Clear Filters** button — resets all five filter states at once

### KPI Cards
Four summary cards shown above the table, populated from the `summary` object in the API response:
- Total Consumed (boxes)
- Total Sqft Consumed
- Total Value (₹)
- Unique Products (with total entry count as subtitle)

### Movement Breakdown Chart
A bar chart (Recharts `BarChart`) showing consumption quantity by movement type. Each bar is colour-coded:

| Movement Type | Colour |
|---------------|--------|
| Sale | Blue `#3b82f6` |
| Damage | Red `#ef4444` |
| Adjustment | Amber `#f59e0b` |
| Transfer Out | Purple `#8b5cf6` |
| Production Material | Emerald `#10b981` |

The chart only renders when there is at least one data row.

### Data Table
- Scrollable horizontal table with sticky header styling
- Type badge per row — coloured pill matching the chart colours
- Alternating row backgrounds for readability
- Totals footer row — summing qty consumed, sqft consumed, and total value for the currently visible (filtered) rows
- Empty state message when no data matches the filters

### Export Button
Top-right of the page. Calls `reportApi.exportInventoryConsumption(params)` with the current filter state, receives a `Blob`, creates a temporary anchor, clicks it, and revokes the object URL — no page navigation or popup required. Button text changes to "Exporting…" during the request.

---

## Role Access

Both API endpoints and the frontend route share the same role allowlist:

| Role | Access |
|------|--------|
| `super_admin` | ✅ |
| `admin` | ✅ |
| `accountant` | ✅ |
| `warehouse_manager` | ✅ |
| `viewer` | ✅ |
| `supervisor` | ❌ |
| `sales` | ❌ |
| `warehouse_staff` | ❌ |

This matches the access pattern of the existing GST, Revenue, and Aging reports.

---

## Multi-Tenant Safety

All queries in `getInventoryConsumptionReport()` and `exportInventoryConsumptionExcel()` are scoped to `req.tenantId`:

- `stock_ledger` is filtered by `sl.tenant_id = ?`
- The `stock_summary` subquery for avg cost is filtered by `tenant_id = ?` in its own WHERE clause
- `products` and `warehouses` are accessed only via JOIN conditions on rows already scoped to the tenant's ledger

No cross-tenant data can appear in the output.

---

## Known Limitations

| Limitation | Reason | Future Fix |
|------------|--------|------------|
| Unit cost reflects **current** avg cost, not historical cost at time of movement | `stock_ledger` does not store unit cost at the time of each movement | Add `unit_price` column to `stock_ledger` and populate it in `postStockMovement()` |
| No pagination on the JSON endpoint | Consumption reports are typically run for a bounded date range; result sets are manageable | Add `page` / `limit` params if customers report performance issues with large date ranges |
| Client-side search only (no server-side full-text) | Interactive search on an already-fetched dataset is fast enough at this scale | If datasets grow large, move search to the SQL query with `LIKE` on product name/code |
| Production cost = qty × avg_cost — does not include labor/machine/wastage from production orders | Production order overhead costs live in `production_orders.labor_cost` etc., not in `stock_ledger` | A future "Production Cost Breakdown" sub-report can join `production_orders` on `reference_id` for `production_material` rows |

---

## Dependency Added

| Package | Version | Used For |
|---------|---------|----------|
| `exceljs` | `^4.x` | Server-side Excel workbook generation with full styling support |

No frontend dependencies were added.

---

*Generated as part of the Tiles WMS feature implementation — 2026-05-28*
