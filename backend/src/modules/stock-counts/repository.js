'use strict';
const { query } = require('../../config/db');
const { parsePagination, buildSearchClause } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_SORT = ['count_date', 'created_at', 'count_number'];

function findAll(tenantId, queryParams) {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ALLOWED_SORT);
  const conditions = ['sc.tenant_id = ?'];
  const params = [tenantId];
  const { clause: searchClause, params: searchParams } = buildSearchClause(search, ['sc.count_number']);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }
  const orderBy = ALLOWED_SORT.includes(sortBy) ? sortBy : 'created_at';
  const whereSql = conditions.join(' AND ');
  const baseSql = 'SELECT sc.*, w.name AS warehouse_name FROM stock_counts sc JOIN warehouses w ON sc.warehouse_id = w.id AND w.tenant_id = sc.tenant_id WHERE ' + whereSql;
  return Promise.all([
    query(baseSql + ' ORDER BY sc.' + orderBy + ' ' + sortOrder + ' LIMIT ' + limit + ' OFFSET ' + offset, params),
    query('SELECT COUNT(*) AS total FROM stock_counts sc WHERE ' + whereSql, params),
  ]).then(([rows, countRows]) => ({ rows, total: countRows[0].total }));
}

function findById(id, tenantId) {
  return query(
    'SELECT sc.*, w.name AS warehouse_name FROM stock_counts sc JOIN warehouses w ON sc.warehouse_id = w.id AND w.tenant_id = sc.tenant_id WHERE sc.id = ? AND sc.tenant_id = ?',
    [id, tenantId]
  ).then(rows => rows[0] || null);
}

function findItemsByCountId(countId, tenantId) {
  return query(
    'SELECT sci.*, p.name AS product_name, p.code AS product_code FROM stock_count_items sci JOIN products p ON sci.product_id = p.id AND p.tenant_id = sci.tenant_id WHERE sci.stock_count_id = ? AND sci.tenant_id = ? ORDER BY p.code',
    [countId, tenantId]
  );
}

function create(data) {
  const id = uuidv4();
  return query(
    "INSERT INTO stock_counts (id, tenant_id, count_number, warehouse_id, count_type, status, count_date, created_by) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)",
    [id, data.tenant_id, data.count_number, data.warehouse_id, data.count_type || 'full', data.count_date || new Date(), data.created_by]
  ).then(() => id);
}

function loadItemsFromStock(trx, countId, tenantId, warehouseId) {
  return trx.query(
    'SELECT ss.product_id, ss.shade_id, ss.batch_id, ss.rack_id, ss.total_boxes AS system_boxes FROM stock_summary ss WHERE ss.tenant_id = ? AND ss.warehouse_id = ?',
    [tenantId, warehouseId]
  ).then(rows => {
    const promises = rows.map(r => {
      const itemId = uuidv4();
      return trx.query(
        'INSERT INTO stock_count_items (id, tenant_id, stock_count_id, product_id, shade_id, batch_id, rack_id, system_boxes, counted_boxes, variance_boxes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
        [itemId, tenantId, countId, r.product_id, r.shade_id, r.batch_id, r.rack_id, r.system_boxes, r.system_boxes]
      );
    });
    return Promise.all(promises);
  });
}

function updateItemCounted(itemId, countId, tenantId, countedBoxes) {
  return query('SELECT id, system_boxes FROM stock_count_items WHERE id = ? AND stock_count_id = ? AND tenant_id = ?', [itemId, countId, tenantId])
    .then(items => {
      if (!items.length) return;
      const systemBoxes = parseFloat(items[0].system_boxes) || 0;
      const counted = parseFloat(countedBoxes);
      const variance = counted - systemBoxes;
      const status = counted !== null && counted !== undefined ? 'counted' : 'pending';
      return query('UPDATE stock_count_items SET counted_boxes = ?, variance_boxes = ?, status = ? WHERE id = ? AND tenant_id = ?', [counted, variance, status, itemId, tenantId]);
    });
}

module.exports = { findAll, findById, findItemsByCountId, create, loadItemsFromStock, updateItemCounted };
