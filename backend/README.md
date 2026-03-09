# 🏭 Tiles WMS Backend — Production API

> Node.js + Express + MySQL | Multi-Tenant | Enterprise SaaS

---

## 📦 NPM Install

```bash
npm install
```

---

## ⚙️ Environment Setup

```bash
cp .env.example .env
# Edit .env with your MySQL credentials and JWT secrets
```

---

## 🗄️ Database Setup

```bash
# 1. Create DB and all tables
mysql -u root -p < database/schema.sql

# 2. Start the server
npm run dev      # development (nodemon)
npm start        # production
```

---

## 🚀 Architecture

```
src/
├── config/         db.js, env.js
├── middlewares/    auth, role, tenant, error, rateLimiter
├── utils/          logger, response, pagination, docNumber, auditLog, stockHelper
├── constants/      roles, permissions
└── modules/
    ├── auth/             login, refresh, logout, register-tenant, change-password
    ├── products/         full CRUD + code uniqueness
    ├── grn/              create, post (atomic stock update), quality check
    ├── sales-orders/     create, confirm (auto creates pick list)
    ├── invoices/         generate from SO (GST split), issue
    ├── reports/          dashboard KPIs, GST, revenue, aging, stock valuation
    ├── stock-ledger/     append-only ledger with filters
    ├── stock-summary/    current stock snapshot
    └── [all other modules via generic CRUD handler]
```

---

## 🔐 Authentication Flow

### 1. Register Tenant
```http
POST /api/v1/auth/register
{
  "tenantName": "Raj Tiles Pvt Ltd",
  "tenantSlug": "rajtiles",
  "plan": "pro",
  "adminName": "Rajesh Kumar",
  "adminEmail": "admin@rajtiles.com",
  "adminPassword": "Secure@1234",
  "adminPhone": "9876543210"
}
```

### 2. Login
```http
POST /api/v1/auth/login
{
  "email": "admin@rajtiles.com",
  "password": "Secure@1234",
  "tenantSlug": "rajtiles"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "expiresIn": "15m",
    "user": {
      "id": "uuid",
      "name": "Rajesh Kumar",
      "email": "admin@rajtiles.com",
      "role": "admin",
      "tenantId": "tenant-uuid",
      "tenantSlug": "rajtiles"
    }
  }
}
```

### 3. Use Token
```http
Authorization: Bearer eyJhbGci...
```

### 4. JWT Payload Structure
```json
{
  "sub": "user-uuid",
  "tenantId": "tenant-uuid",
  "role": "admin",
  "email": "admin@rajtiles.com",
  "name": "Rajesh Kumar",
  "iat": 1700000000,
  "exp": 1700000900
}
```

---

## 📡 API Endpoints

### Base URL: `http://localhost:5000/api/v1`

| Module | Endpoints |
|--------|-----------|
| **Auth** | POST /auth/login, /auth/refresh, /auth/logout, /auth/register |
| **Products** | GET/POST /products, GET/PUT/DELETE /products/:id |
| **GRN** | GET/POST /grn, GET /grn/:id, POST /grn/:id/post, PUT /grn/:id/items/:itemId/quality |
| **Sales Orders** | GET/POST /sales-orders, GET /sales-orders/:id, POST /sales-orders/:id/confirm |
| **Invoices** | GET/POST /invoices, GET /invoices/:id, POST /invoices/:id/issue |
| **Stock** | GET /stock/summary, GET /stock/ledger |
| **Reports** | GET /reports/dashboard, /reports/gst, /reports/revenue, /reports/aging, /reports/stock-valuation |
| **Vendors** | GET/POST /vendors, GET/PUT/DELETE /vendors/:id |
| **Customers** | GET/POST /customers, GET/PUT/DELETE /customers/:id |
| **Warehouses** | GET/POST /warehouses, GET/PUT/DELETE /warehouses/:id |
| **Purchase Orders** | GET/POST /purchase-orders, GET/PUT /purchase-orders/:id |
| **Alerts** | GET /alerts |
| **Notifications** | GET /notifications |
| **Audit Logs** | GET /audit-logs |

---

## 🏢 Multi-Tenancy

Every authenticated request is automatically scoped to the tenant from the JWT:
```javascript
// Automatically applied in every query:
WHERE tenant_id = req.tenantId

// Never possible to leak cross-tenant data
```

---

## 📊 Standard Response Format

**Success:**
```json
{
  "success": true,
  "message": "Products fetched",
  "data": [...],
  "meta": {
    "page": 1, "limit": 25, "total": 100,
    "totalPages": 4, "hasNext": true, "hasPrev": false
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "code is required",
    "details": [{ "field": "code", "message": "code is required" }]
  }
}
```

---

## 🔑 Roles & Permissions

| Role | Access |
|------|--------|
| `super_admin` | Everything |
| `admin` | All except super-admin functions |
| `warehouse_manager` | GRN, stock, transfers, pick lists |
| `sales` | Sales orders, invoices, customers |
| `accountant` | Payments, reports, credit/debit notes |
| `user` | Read-only (products, stock) |

---

## ⚡ Key Features

- **Atomic Stock Transactions** — GRN posting, sales dispatch use `beginTransaction()` with rollback
- **Auto Document Numbers** — PO-2024-0001, GRN-2024-0042 via locked `document_counters` table
- **GST Calculation** — CGST/SGST for intrastate, IGST for interstate (based on state_code)
- **Low Stock Alerts** — Auto-created/resolved on every stock movement
- **Audit Trail** — Every CREATE/UPDATE/DELETE logged to audit_logs
- **Rate Limiting** — 100 req/15min general, 10 req/15min for auth endpoints
- **Refresh Token Rotation** — Old token deleted on refresh (replay attack prevention)
- **Pagination** — All list endpoints: `?page=1&limit=25&search=term&sortBy=name&sortOrder=ASC`

---

## 🚨 Production Notes

```bash
# Use PM2 for process management
npm install -g pm2
pm2 start index.js --name tiles-wms-api

# Environment variables (never commit .env)
NODE_ENV=production
JWT_SECRET=<min 64 char random string>
JWT_REFRESH_SECRET=<min 64 char random string>
BCRYPT_ROUNDS=12

# Database — use connection pooling
DB_CONNECTION_LIMIT=10

# MySQL — enable SSL in production
DATABASE_URL="mysql://user:pass@host:3306/tiles_wms?ssl=true"
```

---

## 🧪 Postman Collection Example

```json
{
  "info": { "name": "Tiles WMS API", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  "variable": [{ "key": "baseUrl", "value": "http://localhost:5000/api/v1" }, { "key": "token", "value": "" }],
  "item": [
    {
      "name": "Login",
      "request": {
        "method": "POST", "url": "{{baseUrl}}/auth/login",
        "body": { "mode": "raw", "raw": "{\"email\":\"admin@rajtiles.com\",\"password\":\"Secure@1234\",\"tenantSlug\":\"rajtiles\"}", "options": { "raw": { "language": "json" } } }
      }
    },
    {
      "name": "Get Products",
      "request": {
        "method": "GET", "url": "{{baseUrl}}/products?page=1&limit=25",
        "header": [{ "key": "Authorization", "value": "Bearer {{token}}" }]
      }
    }
  ]
}
```

---

*Tiles WMS Backend v1.0 | 44 Tables | 6 Roles | Production-Grade*
