'use strict';
const { query } = require('../../config/db');
const { parsePagination, buildSearchClause } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_SORT = ['return_number', 'return_date', 'created_at', 'status'];

// FIX #16 — findAll now joins purchase_orders to return po_number
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
  const baseSql = `
    SELECT pr.*, v.name AS vendor_name, w.name AS warehouse_name,
           po.po_number AS po_number
    FROM purchase_returns pr
    JOIN vendors v ON v.id = pr.vendor_id AND v.tenant_id = pr.tenant_id
    JOIN warehouses w ON w.id = pr.warehouse_id AND w.tenant_id = pr.tenant_id
    LEFT JOIN purchase_orders po ON po.id = pr.purchase_order_id AND po.tenant_id = pr.tenant_id
    WHERE ${whereSql}`;
  const [rows, countRows] = await Promise.all([
    query(`${baseSql} ORDER BY pr.${orderBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM purchase_returns pr WHERE ${whereSql}`, params),
  ]);
  return { rows, total: countRows[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT pr.*, v.name AS vendor_name, w.name AS warehouse_name,
            po.po_number AS po_number
     FROM purchase_returns pr
     JOIN vendors v ON v.id = pr.vendor_id AND v.tenant_id = pr.tenant_id
     JOIN warehouses w ON w.id = pr.warehouse_id AND w.tenant_id = pr.tenant_id
     LEFT JOIN purchase_orders po ON po.id = pr.purchase_order_id AND po.tenant_id = pr.tenant_id
     WHERE pr.id = ? AND pr.tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

// FIX #14 — now joins shades table to return shade_name, shade_code, shade_hex
const findItemsByReturnId = async (returnId, tenantId) => {
  return query(
    `SELECT pri.*, p.name AS product_name, p.code AS product_code, p.sqft_per_box,
            s.shade_name, s.shade_code, s.hex_color AS shade_hex
     FROM purchase_return_items pri
     JOIN products p ON p.id = pri.product_id AND p.tenant_id = pri.tenant_id
     LEFT JOIN shades s ON s.id = pri.shade_id AND s.tenant_id = pri.tenant_id
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
      data.grn_id            || null,
      data.vendor_id,
      data.warehouse_id,
      data.return_date,
      data.reason,
      data.status            || 'draft',
      data.total_boxes,
      data.notes             || null,
      data.vehicle_number    || null,
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
      item.grn_item_id  || null,
      item.product_id,
      item.shade_id     || null,
      item.batch_id     || null,
      item.returned_boxes,
      item.returned_pieces ?? 0,
      item.unit_price,
      item.return_reason || null,
      lineTotal,
    ]
  );
  return id;
};

// FIX #15 — new function to delete items for replacement during update
const deleteReturnItems = async (returnId, tenantId, trx) => {
  const run = trx ? (sql, params) => trx.query(sql, params) : (sql, params) => query(sql, params);
  await run(
    'DELETE FROM purchase_return_items WHERE purchase_return_id = ? AND tenant_id = ?',
    [returnId, tenantId]
  );
};

const getStockBalance = async (trx, tenantId, warehouseId, productId, shadeId, batchId) => {
  const rows = await trx.query(
    `SELECT total_boxes, total_pieces FROM stock_summary
     WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?
       AND (shade_id <=> ?) AND (batch_id <=> ?) AND (rack_id <=> ?)`,
    [tenantId, warehouseId, productId, shadeId || null, batchId || null, null]
  );
  return rows[0] || { total_boxes: 0, total_pieces: 0 };
};

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
  if (data.return_date    !== undefined) { updates.push('return_date = ?');    params.push(data.return_date); }
  if (data.reason         !== undefined) { updates.push('reason = ?');         params.push(data.reason); }
  if (data.notes          !== undefined) { updates.push('notes = ?');          params.push(data.notes); }
  if (data.vehicle_number !== undefined) { updates.push('vehicle_number = ?'); params.push(data.vehicle_number); }
  if (data.total_boxes    !== undefined) { updates.push('total_boxes = ?');    params.push(data.total_boxes); }
  if (updates.length === 0) return;
  params.push(id, tenantId);
  await query(
    `UPDATE purchase_returns SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
    params
  );
};

const updateReturnStatus = async (trx, id, tenantId, status) => {
  await trx.query(
    'UPDATE purchase_returns SET status = ? WHERE id = ? AND tenant_id = ?',
    [status, id, tenantId]
  );
};

// FIX #13 — new function: recalculates and updates purchase_order.return_status
const updatePOReturnStatus = async (trx, purchaseOrderId, tenantId) => {
  if (!purchaseOrderId) return;
  await trx.query(
    `UPDATE purchase_orders SET
       return_status = CASE
         WHEN (
           SELECT COALESCE(SUM(poi.ordered_boxes), 0)
           FROM purchase_order_items poi
           WHERE poi.purchase_order_id = ? AND poi.tenant_id = ?
         ) = 0 THEN 'none'
         WHEN (
           SELECT COALESCE(SUM(pri.returned_boxes), 0)
           FROM purchase_return_items pri
           JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
           WHERE pr.purchase_order_id = ? AND pr.tenant_id = ? AND pr.status = 'dispatched'
         ) >= (
           SELECT COALESCE(SUM(poi.ordered_boxes), 0)
           FROM purchase_order_items poi
           WHERE poi.purchase_order_id = ? AND poi.tenant_id = ?
         ) THEN 'full'
         WHEN (
           SELECT COALESCE(SUM(pri.returned_boxes), 0)
           FROM purchase_return_items pri
           JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
           WHERE pr.purchase_order_id = ? AND pr.tenant_id = ? AND pr.status = 'dispatched'
         ) > 0 THEN 'partial'
         ELSE 'none'
       END,
       updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [
      purchaseOrderId, tenantId,
      purchaseOrderId, tenantId,
      purchaseOrderId, tenantId,
      purchaseOrderId, tenantId,
      purchaseOrderId, tenantId,
    ]
  );
};

const deleteReturn = async (id, tenantId) => {
  await query('DELETE FROM purchase_return_items WHERE purchase_return_id = ? AND tenant_id = ?', [id, tenantId]);
  const result = await query('DELETE FROM purchase_returns WHERE id = ? AND tenant_id = ? AND status = ?', [id, tenantId, 'draft']);
  return result && result.affectedRows > 0;
};

module.exports = {
  findAll,
  findById,
  findItemsByReturnId,
  createReturn,
  createReturnItem,
  deleteReturnItems,
  getStockBalance,
  getProductSqftPerBox,
  updateReturn,
  updateReturnStatus,
  updatePOReturnStatus,
  deleteReturn,
};
