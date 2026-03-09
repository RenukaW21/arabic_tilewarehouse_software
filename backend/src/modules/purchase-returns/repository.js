'use strict';
const { query } = require('../../config/db');
const { parsePagination, buildSearchClause } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_SORT = ['return_number', 'return_date', 'created_at', 'status'];

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ALLOWED_SORT);
  const conditions = ['pr.tenant_id = ?'];
  const params = [tenantId];
  if (queryParams.status) {
    conditions.push('pr.status = ?');
    params.push(queryParams.status);
  }
  if (queryParams.vendor_id) {
    conditions.push('pr.vendor_id = ?');
    params.push(queryParams.vendor_id);
  }
  if (queryParams.warehouse_id) {
    conditions.push('pr.warehouse_id = ?');
    params.push(queryParams.warehouse_id);
  }
  const { clause: searchClause, params: searchParams } = buildSearchClause(search, ['pr.return_number']);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }
  const orderBy = ALLOWED_SORT.includes(sortBy) ? sortBy : 'created_at';
  const whereSql = conditions.join(' AND ');
  const baseSql = `SELECT pr.*, v.name AS vendor_name, w.name AS warehouse_name
    FROM purchase_returns pr
    JOIN vendors v ON v.id = pr.vendor_id AND v.tenant_id = pr.tenant_id
    JOIN warehouses w ON w.id = pr.warehouse_id AND w.tenant_id = pr.tenant_id
    WHERE ${whereSql}`;
  const [rows, countRows] = await Promise.all([
    query(`${baseSql} ORDER BY pr.${orderBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM purchase_returns pr WHERE ${whereSql}`, params),
  ]);
  return { rows, total: countRows[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT pr.*, v.name AS vendor_name, w.name AS warehouse_name
     FROM purchase_returns pr
     JOIN vendors v ON v.id = pr.vendor_id AND v.tenant_id = pr.tenant_id
     JOIN warehouses w ON w.id = pr.warehouse_id AND w.tenant_id = pr.tenant_id
     WHERE pr.id = ? AND pr.tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const findItemsByReturnId = async (returnId, tenantId) => {
  return query(
    `SELECT pri.*, p.name AS product_name, p.code AS product_code, p.sqft_per_box
     FROM purchase_return_items pri
     JOIN products p ON p.id = pri.product_id AND p.tenant_id = pri.tenant_id
     WHERE pri.purchase_return_id = ? AND pri.tenant_id = ?`,
    [returnId, tenantId]
  );
};

const createReturn = async (data, trx) => {
  const id = uuidv4();
  const run = trx ? (sql, params) => trx.query(sql, params) : (sql, params) => query(sql, params);
  await run(
    `INSERT INTO purchase_returns
     (id, tenant_id, return_number, purchase_order_id, grn_id, vendor_id, warehouse_id,
      return_date, reason, status, total_boxes, notes, vehicle_number, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      id,
      data.tenant_id,
      data.return_number,
      data.purchase_order_id || null,
      data.grn_id || null,
      data.vendor_id,
      data.warehouse_id,
      data.return_date,
      data.reason,
      data.status || 'dispatched',
      data.total_boxes,
      data.notes || null,
      data.vehicle_number || null,
      data.created_by,
    ]
  );
  return id;
};

const createReturnItem = async (item, trx) => {
  const id = uuidv4();
  const lineTotal = (parseFloat(item.returned_boxes) || 0) * (parseFloat(item.unit_price) || 0);
  const run = trx ? (sql, params) => trx.query(sql, params) : (sql, params) => query(sql, params);
  await run(
    `INSERT INTO purchase_return_items
     (id, tenant_id, purchase_return_id, grn_item_id, product_id, shade_id, batch_id,
      returned_boxes, returned_pieces, unit_price, return_reason, line_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      item.tenant_id,
      item.purchase_return_id,
      item.grn_item_id || null,
      item.product_id,
      item.shade_id || null,
      item.batch_id || null,
      item.returned_boxes,
      item.returned_pieces ?? 0,
      item.unit_price,
      item.return_reason || null,
      lineTotal,
    ]
  );
  return id;
};

/** Get current stock balance for warehouse/product/shade/batch (rack_id null only — same scope as postStockMovement return deduction). */
const getStockBalance = async (trx, tenantId, warehouseId, productId, shadeId, batchId) => {
  const rows = await trx.query(
    `SELECT total_boxes, total_pieces FROM stock_summary
     WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?
       AND (shade_id <=> ?) AND (batch_id <=> ?) AND (rack_id <=> ?)`,
    [tenantId, warehouseId, productId, shadeId || null, batchId || null, null]
  );
  return rows[0] || { total_boxes: 0, total_pieces: 0 };
};

/** Get product sqft_per_box */
const getProductSqftPerBox = async (trx, productId, tenantId) => {
  const rows = await trx.query(
    `SELECT sqft_per_box FROM products WHERE id = ? AND tenant_id = ?`,
    [productId, tenantId]
  );
  return rows[0] ? parseFloat(rows[0].sqft_per_box) || 0 : 0;
};

const updateReturn = async (id, tenantId, data) => {
  const updates = [];
  const params = [];
  if (data.return_date !== undefined) { updates.push('return_date = ?'); params.push(data.return_date); }
  if (data.reason !== undefined) { updates.push('reason = ?'); params.push(data.reason); }
  if (data.notes !== undefined) { updates.push('notes = ?'); params.push(data.notes); }
  if (data.vehicle_number !== undefined) { updates.push('vehicle_number = ?'); params.push(data.vehicle_number); }
  if (updates.length === 0) return;
  params.push(id, tenantId);
  await query(
    `UPDATE purchase_returns SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
    params
  );
};

module.exports = {
  findAll,
  findById,
  findItemsByReturnId,
  createReturn,
  createReturnItem,
  getStockBalance,
  getProductSqftPerBox,
  updateReturn,
};
