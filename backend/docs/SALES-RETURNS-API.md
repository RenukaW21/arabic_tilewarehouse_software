# Sales Returns API — Testing Guide

Base URL: `http://localhost:5000/api/v1` (or your `VITE_API_BASE_URL`).  
All endpoints require **Authentication**: `Authorization: Bearer <token>`.

---

## 1. Get All Returns

**GET** `/sales-returns`

**Query params (optional):**

| Param     | Type   | Description                |
|----------|--------|----------------------------|
| page     | number | Default 1                  |
| limit    | number | Default 25, max 100        |
| search   | string | Return # or customer name  |
| status   | string | draft, received, inspected, completed, cancelled |
| customer_id | string | UUID filter by customer |

**Example:** `GET /sales-returns?page=1&limit=10&status=draft`

**Success (200):**

```json
{
  "success": true,
  "message": "Sales returns fetched",
  "data": [...],
  "meta": { "page": 1, "limit": 25, "total": 5, "totalPages": 1, "hasNext": false, "hasPrev": false }
}
```

---

## 2. Get Single Return

**GET** `/sales-returns/:id`

**Success (200):** `{ "success": true, "data": { "id", "return_number", "customer_id", "items": [...] } }`  
**Error (404):** `{ "success": false, "error": { "code": "NOT_FOUND", "message": "Sales return not found" } }`

---

## 3. Create Return

**POST** `/sales-returns`

**Body (JSON):**

```json
{
  "customer_id": "uuid",
  "warehouse_id": "uuid",
  "return_reason": "Damaged in transit",
  "notes": "Optional notes",
  "sales_order_id": "uuid or null",
  "invoice_id": "uuid or null",
  "return_date": "2025-03-05",
  "items": [
    {
      "product_id": "uuid",
      "returned_boxes": 2,
      "unit_price": 100
    }
  ]
}
```

**Validation:**

- `customer_id`, `warehouse_id`, `return_reason` required.
- `items` array required, min 1 item.
- Each item: `product_id` (uuid), `returned_boxes` (number ≥ 0.01), `unit_price` (number ≥ 0).

**Success (201):** `{ "success": true, "message": "Sales return created", "data": { ... } }`  
**Error (422):** `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [{ "path": ["items", 0, "returned_boxes"], "message": "..." }] } }`

---

## 4. Update Return (draft only)

**PUT** `/sales-returns/:id`

**Body (JSON):** Any subset of:

- `customer_id`, `warehouse_id`, `return_date`, `return_reason`, `notes`
- `items`: same shape as create; replaces all line items when provided

**Success (200):** `{ "success": true, "data": { ... } }`  
**Error (400):** Only draft returns can be updated.  
**Error (404):** Sales return not found.

---

## 5. Delete Return (draft only)

**DELETE** `/sales-returns/:id`

**Success (204):** No body.  
**Error (400):** Only draft returns can be deleted.  
**Error (404):** Sales return not found.

---

## 6. Receive Return (draft → received)

**POST** `/sales-returns/:id/receive`

**Success (200):** Return status set to `received`, stock posted, credit note created.  
**Error (400):** Only draft returns can be received.

---

## Postman / Thunder Client checklist

1. **Create Return** — POST with valid body; expect 201 and `return_number` in response.
2. **Get All** — GET with optional `page`, `limit`, `status`; expect 200 and `data` array + `meta`.
3. **Get Single** — GET with id from create; expect 200 and `items` array.
4. **Update** — PUT with same id, change `return_reason` or `notes`; expect 200 and updated data.
5. **Delete** — DELETE with id of a draft return; expect 204. Get same id again; expect 404.
6. **Validation** — POST with missing `customer_id` or empty `items`; expect 422 and `error.details`.
