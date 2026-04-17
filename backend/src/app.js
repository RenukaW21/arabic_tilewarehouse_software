'use strict';
require('express-async-errors');
const express = require('express');
const OpenAI = require("openai");
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
const alertsRoutes = require('./modules/alerts/routes');
const aiRoutes = require('./modules/ai/ai.routes');
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
const rackInventoryRoutes = require('./modules/rack-inventory/routes');
const vendorPaymentsRoutes = require('./modules/vendor-payments/routes');
const customerPaymentsRoutes = require('./modules/customer-payments/routes');

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
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const API = `/api/${env.API_VERSION}`;

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Global Middleware ─────────────────────────────────────────────────────────
const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.security.corsOrigin === '*') {
      return callback(null, true);
    }

    if (Array.isArray(env.security.corsOrigin) && env.security.corsOrigin.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
};

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
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


app.use(`${API}/ai`, aiRoutes);
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
app.use(`${API}/alerts`, alertsRoutes); app.use(`${API}/rack-inventory`, rackInventoryRoutes);

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
app.use(`${API}/customer-payments`, customerPaymentsRoutes);
app.use(`${API}/vendor-payments`, vendorPaymentsRoutes);
app.use(`${API}/alerts`, buildCrudRouter('low_stock_alerts', ['alerted_at']));
app.use(`${API}/notifications`, buildCrudRouter('notifications', ['created_at']));
app.use(`${API}/audit-logs`, buildCrudRouter('audit_logs', ['created_at']));

// ─── Debug Stock Endpoint ─────────────────────────────────────────────────────
// GET /api/v1/debug/stock?product_id=X[&warehouse_id=Y]
// Returns total / reserved / available / per-bin / recent-ledger for a product.
app.get(`${API}/debug/stock`, require('./middlewares/auth.middleware').authenticate, async (req, res) => {
  const { query: dbQuery } = require('./config/db');
  const { success: okResp } = require('./utils/response');
  const tenantId = req.tenantId;
  const productId = req.query.product_id;
  if (!productId) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'product_id is required' } });
  }
  const conditions = ['ss.tenant_id = ?', 'ss.product_id = ?'];
  const params = [tenantId, productId];
  if (req.query.warehouse_id) { conditions.push('ss.warehouse_id = ?'); params.push(req.query.warehouse_id); }

  const [bins, reservations, ledger] = await Promise.all([
    dbQuery(
      `SELECT ss.warehouse_id, ss.rack_id, ss.shade_id, ss.batch_id,
              ss.total_boxes, ss.total_pieces, ss.total_sqft,
              COALESCE(res.reserved_boxes, 0) AS reserved_boxes,
              GREATEST(0, ss.total_boxes - COALESCE(res.reserved_boxes, 0)) AS available_boxes,
              w.name AS warehouse_name, r.name AS rack_name
       FROM stock_summary ss
       JOIN warehouses w ON ss.warehouse_id = w.id
       LEFT JOIN racks r ON ss.rack_id = r.id
       LEFT JOIN (
         SELECT tenant_id, warehouse_id, product_id, shade_id, batch_id,
                SUM(boxes_reserved) AS reserved_boxes
         FROM stock_reservations
         GROUP BY tenant_id, warehouse_id, product_id, shade_id, batch_id
       ) res ON res.tenant_id = ss.tenant_id AND res.warehouse_id = ss.warehouse_id
             AND res.product_id = ss.product_id
             AND (res.shade_id <=> ss.shade_id) AND (res.batch_id <=> ss.batch_id)
       WHERE ${conditions.join(' AND ')}
       ORDER BY w.name, r.name`,
      params
    ),
    dbQuery(
      `SELECT sr.sales_order_id, so.so_number, sr.warehouse_id, sr.shade_id, sr.batch_id,
              sr.boxes_reserved, sr.created_at
       FROM stock_reservations sr
       LEFT JOIN sales_orders so ON sr.sales_order_id = so.id
       WHERE sr.tenant_id = ? AND sr.product_id = ?`,
      [tenantId, productId]
    ),
    dbQuery(
      `SELECT sl.transaction_type, sl.rack_id, sl.shade_id, sl.batch_id,
              sl.boxes_in, sl.boxes_out, sl.balance_boxes,
              sl.reference_type, sl.reference_id, sl.notes, sl.created_at
       FROM stock_ledger sl
       WHERE sl.tenant_id = ? AND sl.product_id = ?
       ORDER BY sl.created_at DESC LIMIT 20`,
      [tenantId, productId]
    ),
  ]);

  const total_boxes    = bins.reduce((s, r) => s + parseFloat(r.total_boxes    || 0), 0);
  const reserved_boxes = bins.reduce((s, r) => s + parseFloat(r.reserved_boxes || 0), 0);
  const available_boxes = bins.reduce((s, r) => s + parseFloat(r.available_boxes || 0), 0);

  return okResp(res, {
    product_id: productId,
    summary: { total_boxes, reserved_boxes, available_boxes },
    bins,
    active_reservations: reservations,
    recent_ledger: ledger,
  }, 'Stock debug info');
});

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
