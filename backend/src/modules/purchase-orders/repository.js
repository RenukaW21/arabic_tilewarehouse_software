'use strict';
const { query } = require('../../config/db');
const { parsePagination, buildSearchClause } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');

const run = (trx, sql, params) => (trx ? trx.query(sql, params) : query(sql, params));

const ALLOWED_SORT = ['po_number', 'order_date', 'created_at', 'status'];

// ─── FIND ALL ─────────────────────────────────────────────────────────────────
const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ALLOWED_SORT);
  const conditions = ['po.tenant_id = ?'];
  const params = [tenantId];

  if (queryParams.status) {
    conditions.push('po.status = ?');
    params.push(queryParams.status);
  }
  if (queryParams.vendor_id) {
    conditions.push('po.vendor_id = ?');
    params.push(queryParams.vendor_id);
  }
  if (queryParams.warehouse_id) {
    conditions.push('po.warehouse_id = ?');
    params.push(queryParams.warehouse_id);
  }
  // FIX #5 — received_date range filters
  if (queryParams.received_date_from) {
    conditions.push('po.received_date >= ?');
    params.push(queryParams.received_date_from);
  }
  if (queryParams.received_date_to) {
    conditions.push('po.received_date <= ?');
    params.push(queryParams.received_date_to);
  }

  const { clause: searchClause, params: searchParams } = buildSearchClause(search, ['po.po_number']);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }

  const orderBy = ALLOWED_SORT.includes(sortBy) ? sortBy : 'created_at';
  const whereSql = conditions.join(' AND ');

  const baseSql = `
    SELECT
      po.*,
      v.name        AS vendor_name,
      w.name        AS warehouse_name,
      u.name        AS created_by_name
    FROM purchase_orders po
    JOIN vendors    v ON v.id = po.vendor_id    AND v.tenant_id  = po.tenant_id
    JOIN warehouses w ON w.id = po.warehouse_id AND w.tenant_id  = po.tenant_id
    LEFT JOIN users u ON u.id = po.created_by
    WHERE ${whereSql}`;

  const [rows, countRows] = await Promise.all([
    query(`${baseSql} ORDER BY po.${orderBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM purchase_orders po WHERE ${whereSql}`, params),
  ]);

  return { rows, total: countRows[0].total };
};

// ─── FIND BY ID ───────────────────────────────────────────────────────────────
const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT
       po.*,
       v.name    AS vendor_name,
       w.name    AS warehouse_name,
       u.name    AS created_by_name,
       ab.name   AS approved_by_name
     FROM purchase_orders po
     JOIN vendors    v  ON v.id  = po.vendor_id    AND v.tenant_id = po.tenant_id
     JOIN warehouses w  ON w.id  = po.warehouse_id AND w.tenant_id = po.tenant_id
     LEFT JOIN users u  ON u.id  = po.created_by
     LEFT JOIN users ab ON ab.id = po.approved_by
     WHERE po.id = ? AND po.tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

// ─── FIND ITEMS BY PO ID ──────────────────────────────────────────────────────
const findItemsByPOId = async (purchaseOrderId, tenantId) => {
  return query(
    `SELECT
       poi.*,
       p.name       AS product_name,
       p.code       AS product_code,
       s.shade_name AS shade_name,
       s.shade_code AS shade_code,
       s.hex_color  AS shade_hex
     FROM purchase_order_items poi
     JOIN     products p ON p.id = poi.product_id AND p.tenant_id = poi.tenant_id
     LEFT JOIN shades  s ON s.id = poi.shade_id   AND s.tenant_id = poi.tenant_id
     WHERE poi.purchase_order_id = ? AND poi.tenant_id = ?
     ORDER BY poi.id`,
    [purchaseOrderId, tenantId]
  );
};

// ─── FIND SINGLE PO ITEM ──────────────────────────────────────────────────────
// FIX #6 — needed by receiveItem service method
const findPOItemById = async (itemId, purchaseOrderId, tenantId) => {
  const rows = await query(
    `SELECT * FROM purchase_order_items
     WHERE id = ? AND purchase_order_id = ? AND tenant_id = ?`,
    [itemId, purchaseOrderId, tenantId]
  );
  return rows[0] || null;
};

// ─── CREATE PO ────────────────────────────────────────────────────────────────
const createPO = async (data, trx = null) => {
  const id = uuidv4();
  await run(
    trx,
    `INSERT INTO purchase_orders
       (id, tenant_id, po_number, vendor_id, warehouse_id, status, order_date, expected_date,
        total_amount, discount_amount, tax_amount, additional_discount, grand_total, notes, created_by)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.tenant_id,
      data.po_number,
      data.vendor_id,
      data.warehouse_id,
      data.order_date,
      data.expected_date        || null,
      data.total_amount         ?? 0,
      data.discount_amount      ?? 0,
      data.tax_amount           ?? 0,
      data.additional_discount  ?? 0,   // FIX #3
      data.grand_total          ?? 0,
      data.notes                || null,
      data.created_by,
    ]
  );
  return id;
};

// ─── CREATE PO ITEM ───────────────────────────────────────────────────────────
const createPOItem = async (item, trx = null) => {
  const id = uuidv4();
  const lineTotal =
    (parseFloat(item.ordered_boxes) || 0) *
    (parseFloat(item.unit_price)    || 0) *
    (1 - (parseFloat(item.discount_pct) || 0) / 100) *
    (1 + (parseFloat(item.tax_pct)      || 0) / 100);

  await run(
    trx,
    `INSERT INTO purchase_order_items
       (id, tenant_id, purchase_order_id, product_id, shade_id, ordered_boxes, ordered_pieces,
        received_boxes, unit_price, discount_pct, tax_pct, line_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [
      id,
      item.tenant_id,
      item.purchase_order_id,
      item.product_id,
      item.shade_id || null,
      item.ordered_boxes,
      item.ordered_pieces || 0,
      item.unit_price,
      item.discount_pct ?? 0,
      item.tax_pct      ?? 0,
      lineTotal,
    ]
  );
  return id;
};

// ─── UPDATE PO ────────────────────────────────────────────────────────────────
const updatePO = async (id, tenantId, data, trx = null) => {
  const allowed = [
    'vendor_id', 'warehouse_id', 'order_date', 'expected_date', 'notes',
    'total_amount', 'discount_amount', 'tax_amount', 'additional_discount', 'grand_total',
    'status', 'return_status', 'payment_status', 'received_date',
    'approved_by', 'approved_at',
  ];

  const updates = [];
  const values  = [];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(data[key]);
    }
  }

  if (updates.length === 0) return;

  values.push(id, tenantId);
  await run(
    trx,
    `UPDATE purchase_orders SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    values
  );
};

// ─── UPDATE PO ITEM ───────────────────────────────────────────────────────────
// FIX #7 — accepts optional trx for transaction safety
const updatePOItem = async (itemId, purchaseOrderId, tenantId, data, trx = null) => {
  const lineTotal =
    (parseFloat(data.ordered_boxes) || 0) *
    (parseFloat(data.unit_price)    || 0) *
    (1 - (parseFloat(data.discount_pct) || 0) / 100) *
    (1 + (parseFloat(data.tax_pct)      || 0) / 100);

  await run(
    trx,
    `UPDATE purchase_order_items SET
       product_id = ?, shade_id = ?, ordered_boxes = ?, ordered_pieces = ?,
       unit_price = ?, discount_pct = ?, tax_pct = ?, line_total = ?
     WHERE id = ? AND purchase_order_id = ? AND tenant_id = ?`,
    [
      data.product_id,
      data.shade_id || null,
      data.ordered_boxes,
      data.ordered_pieces  ?? 0,
      data.unit_price,
      data.discount_pct    ?? 0,
      data.tax_pct         ?? 0,
      lineTotal,
      itemId,
      purchaseOrderId,
      tenantId,
    ]
  );
};

// ─── UPDATE PO ITEM RECEIVED BOXES ────────────────────────────────────────────
// FIX #6 — dedicated update for received_boxes only
const updatePOItemReceivedBoxes = async (itemId, purchaseOrderId, tenantId, receivedBoxes, trx = null) => {
  await run(
    trx,
    `UPDATE purchase_order_items
     SET received_boxes = ?
     WHERE id = ? AND purchase_order_id = ? AND tenant_id = ?`,
    [receivedBoxes, itemId, purchaseOrderId, tenantId]
  );
};

// ─── DELETE PO ITEM ───────────────────────────────────────────────────────────
const deletePOItem = async (itemId, purchaseOrderId, tenantId) => {
  await query(
    'DELETE FROM purchase_order_items WHERE id = ? AND purchase_order_id = ? AND tenant_id = ?',
    [itemId, purchaseOrderId, tenantId]
  );
};

const deleteAllPOItems = async (purchaseOrderId, tenantId, trx = null) => {
  await run(
    trx,
    'DELETE FROM purchase_order_items WHERE purchase_order_id = ? AND tenant_id = ?',
    [purchaseOrderId, tenantId]
  );
};

// ─── STATUS HELPERS ───────────────────────────────────────────────────────────
const setPOStatus = async (id, tenantId, status, trx = null) => {
  await run(
    trx,
    'UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
    [status, id, tenantId]
  );
};

const setPOApproval = async (id, tenantId, userId, trx = null) => {
  await run(
    trx,
    `UPDATE purchase_orders
     SET status = 'confirmed', approved_by = ?, approved_at = NOW(), updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [userId, id, tenantId]
  );
};

// ─── MISC ─────────────────────────────────────────────────────────────────────
const countGRNByPO = async (purchaseOrderId, tenantId) => {
  const rows = await query(
    'SELECT COUNT(*) AS total FROM grn WHERE purchase_order_id = ? AND tenant_id = ?',
    [purchaseOrderId, tenantId]
  );
  return rows[0].total;
};

const findProductInPO = async (purchaseOrderId, productId, shadeId, excludeItemId, tenantId) => {
  const params = [purchaseOrderId, productId, tenantId];
  let sql = `SELECT id FROM purchase_order_items
             WHERE purchase_order_id = ? AND product_id = ? AND tenant_id = ?`;

  if (shadeId) {
    sql += ` AND (shade_id <=> ?)`;
    params.push(shadeId);
  } else {
    sql += ` AND shade_id IS NULL`;
  }

  if (excludeItemId) {
    sql += ` AND id != ?`;
    params.push(excludeItemId);
  }

  const rows = await query(sql, params);
  return rows[0] || null;
};

module.exports = {
  findAll,
  findById,
  findItemsByPOId,
  findPOItemById,
  createPO,
  createPOItem,
  updatePO,
  updatePOItem,
  updatePOItemReceivedBoxes,
  deletePOItem,
  deleteAllPOItems,
  setPOStatus,
  setPOApproval,
  countGRNByPO,
  findProductInPO,
};
