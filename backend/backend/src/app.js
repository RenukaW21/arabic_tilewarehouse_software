'use strict';
require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const env = require('./config/env');
const logger = require('./utils/logger');
const { apiLimiter } = require('./middlewares/rateLimiter.middleware');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const path = require('path');
const vendorRoutes = require('./modules/vendors/vendor.routes');
const customerRoutes = require('./modules/customers/customer.routes');
const warehouseRoutes = require('./modules/warehouses/warehouse.routes');
const rackRoutes = require('./modules/racks/rack.routes');
const stockTransferRoutes = require('./modules/stock-transfers/transfer.routes');

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes = require('./modules/auth/routes');
const productRoutes = require('./modules/products/routes');
const grnRoutes = require('./modules/grn/routes');
const salesOrderRoutes = require('./modules/sales-orders/routes');
const invoiceRoutes = require('./modules/invoices/routes');
const reportRoutes = require('./modules/reports/routes');
const stockLedgerRoutes = require('./modules/stock-ledger/routes');
const stockSummaryRoutes = require('./modules/stock-summary/routes');
const categoryRoutes = require('./modules/categories/routes');
const purchaseOrderRoutes = require('./modules/purchase-orders/routes');
const purchaseReturnRoutes = require('./modules/purchase-returns/routes');
const inventoryRoutes = require('./modules/inventory/routes');
const damageEntriesRoutes = require('./modules/damage-entries/routes');
const stockAdjustmentsRoutes = require('./modules/stock-adjustments/routes');
const stockCountsRoutes = require('./modules/stock-counts/routes');
const pickListsRoutes = require('./modules/pick-lists/routes');
const deliveryChallansRoutes = require('./modules/delivery-challans/routes');
const salesReturnsRoutes = require('./modules/sales-returns/routes');
const usersRoutes = require('./modules/users/routes');
const gstConfigRoutes = require('./modules/gst-config/routes');

// Inline route handlers for CRUD modules (same pattern as products)
const buildCrudRouter = (tableName, allowedSortFields = ['created_at']) => {
  const router = express.Router();
  const { authenticate } = require('./middlewares/auth.middleware');
  const { query } = require('./config/db');
  const { success, created, paginated } = require('./utils/response');
  const { parsePagination } = require('./utils/pagination');
  const { v4: uuidv4 } = require('uuid');

  router.use(authenticate);

  // GET all — list with pagination
  router.get('/', async (req, res) => {
    const { page, limit, offset, sortBy, sortOrder } = parsePagination(req.query, allowedSortFields);
    const conditions = [`tenant_id = ?`];
    const params = [req.tenantId];
    const [rows, count] = await Promise.all([
      query(`SELECT * FROM ${tableName} WHERE ${conditions.join(' AND ')} ORDER BY ${sortBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
      query(`SELECT COUNT(*) AS total FROM ${tableName} WHERE ${conditions.join(' AND ')}`, params),
    ]);
    return paginated(res, rows, { page, limit, total: count[0].total });
  });

  // GET by ID
  router.get('/:id', async (req, res) => {
    const rows = await query(`SELECT * FROM ${tableName} WHERE id = ? AND tenant_id = ?`, [req.params.id, req.tenantId]);
    const row = rows[0];
    if (!row) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Record not found' } });
    return success(res, row);
  });

  // POST — create record
  router.post('/', async (req, res) => {
    const id = uuidv4();
    const body = { ...req.body, id, tenant_id: req.tenantId };
    delete body.created_at;
    delete body.updated_at;
    const keys = Object.keys(body);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => body[k]);
    await query(
      `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`,
      values
    );
    const newRows = await query(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
    return created(res, newRows[0]);
  });

  // PUT — update record
  router.put('/:id', async (req, res) => {
    const existing = await query(`SELECT id FROM ${tableName} WHERE id = ? AND tenant_id = ?`, [req.params.id, req.tenantId]);
    if (!existing.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Record not found' } });
    const body = { ...req.body };
    delete body.id;
    delete body.tenant_id;
    delete body.created_at;
    const columns = await query(`SHOW COLUMNS FROM ${tableName} LIKE 'updated_at'`);
    if (columns.length) {
      body.updated_at = new Date();
    }
    const keys = Object.keys(body);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...keys.map(k => body[k]), req.params.id, req.tenantId];
    await query(`UPDATE ${tableName} SET ${setClause} WHERE id = ? AND tenant_id = ?`, values);
    const updated = await query(`SELECT * FROM ${tableName} WHERE id = ?`, [req.params.id]);
    return success(res, updated[0]);
  });

  // DELETE — soft delete if is_active column exists, otherwise hard delete
  router.delete('/:id', async (req, res) => {
    const existing = await query(`SELECT id FROM ${tableName} WHERE id = ? AND tenant_id = ?`, [req.params.id, req.tenantId]);
    if (!existing.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Record not found' } });
    const columns = await query(`SHOW COLUMNS FROM ${tableName} LIKE 'is_active'`);
    if (columns.length) {
      await query(`UPDATE ${tableName} SET is_active = FALSE WHERE id = ? AND tenant_id = ?`, [req.params.id, req.tenantId]);
    } else {
      await query(`DELETE FROM ${tableName} WHERE id = ? AND tenant_id = ?`, [req.params.id, req.tenantId]);
    }
    return res.status(204).send();
  });

  return router;
};

const app = express();
const API = `/api/${env.API_VERSION}`;

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Global Middleware ─────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: env.security.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.isProd ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));
// app.use(`${API}/`, apiLimiter); 

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    const { query } = require('./config/db');
    await query('SELECT 1');
  } catch {
    dbStatus = 'error';
  }
  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    service: 'Tiles WMS API',
    version: env.API_VERSION,
    timestamp: new Date().toISOString(),
    db: dbStatus,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/products`, productRoutes);
app.use(`${API}/grn`, grnRoutes);
app.use(`${API}/sales-orders`, salesOrderRoutes);
app.use(`${API}/invoices`, invoiceRoutes);
app.use(`${API}/reports`, reportRoutes);
app.use(`${API}/stock/ledger`, stockLedgerRoutes);
app.use(`${API}/stock/summary`, stockSummaryRoutes);
app.use(`${API}/inventory`, inventoryRoutes);
app.use(`${API}/damage-entries`, damageEntriesRoutes);
app.use(`${API}/stock-adjustments`, stockAdjustmentsRoutes);
app.use(`${API}/stock-counts`, stockCountsRoutes);
app.use(`${API}/pick-lists`, pickListsRoutes);
app.use(`${API}/delivery-challans`, deliveryChallansRoutes);
app.use(`${API}/sales-returns`, salesReturnsRoutes);
app.use(`${API}/users`, usersRoutes);
app.use(`${API}/setup/gst`, gstConfigRoutes);

// Full CRUD modules (GET, POST, PUT, DELETE) — Vendors uses full module (pagination, search, soft delete)
app.use(`${API}/vendors`, vendorRoutes);
app.use(`${API}/customers`, customerRoutes);
app.use(`${API}/warehouses`, warehouseRoutes);
app.use(`${API}/racks`, rackRoutes);
app.use(`${API}/stock-transfers`, stockTransferRoutes);
app.use(`${API}/purchase-orders`, purchaseOrderRoutes);
// app.use(`${API}/categories`, buildCrudRouter('product_categories', ['name']));
app.use(`${API}/categories`, categoryRoutes);
app.use(`${API}/shades`, buildCrudRouter('shades', ['shade_code', 'created_at']));
app.use(`${API}/batches`, buildCrudRouter('batches', ['batch_number', 'created_at']));
app.use(`${API}/purchase-returns`, purchaseReturnRoutes);
app.use(`${API}/credit-notes`, buildCrudRouter('credit_notes', ['cn_date', 'created_at']));
app.use(`${API}/debit-notes`, buildCrudRouter('debit_notes', ['dn_date', 'created_at']));
app.use(`${API}/customer-payments`, buildCrudRouter('customer_payments', ['payment_date', 'created_at']));
app.use(`${API}/vendor-payments`, buildCrudRouter('vendor_payments', ['payment_date', 'created_at']));
app.use(`${API}/alerts`, buildCrudRouter('low_stock_alerts', ['alerted_at']));
app.use(`${API}/notifications`, buildCrudRouter('notifications', ['created_at']));
app.use(`${API}/audit-logs`, buildCrudRouter('audit_logs', ['created_at']));

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
