'use strict';
const { query } = require('../../config/db');
const { parsePagination, buildSearchClause } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_SORT = ['created_at', 'reason', 'status'];

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ALLOWED_SORT);
  const conditions = ['sa.tenant_id = ?'];
  const params = [tenantId];
  const { clause: searchClause, params: searchParams } = buildSearchClause(search, ['sa.reason', 'p.name', 'p.code']);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }
  const orderBy = ALLOWED_SORT.includes(sortBy) ? sortBy : 'created_at';
  const whereSql = conditions.join(' AND ');
  const baseSql = `
    SELECT sa.*, p.name AS product_name, p.code AS product_code, w.name AS warehouse_name
    FROM stock_adjustments sa
    JOIN products p ON sa.product_id = p.id AND p.tenant_id = sa.tenant_id
    JOIN warehouses w ON sa.warehouse_id = w.id AND w.tenant_id = sa.tenant_id
    WHERE ${whereSql}
  `;
  const [rows, countRows] = await Promise.all([
    query(`${baseSql} ORDER BY sa.${orderBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM stock_adjustments sa JOIN products p ON sa.product_id = p.id AND p.tenant_id = sa.tenant_id WHERE ${whereSql}`, params),
  ]);
  return { rows, total: countRows[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT sa.*, p.name AS product_name, p.code AS product_code, w.name AS warehouse_name
     FROM stock_adjustments sa
     JOIN products p ON sa.product_id = p.id AND p.tenant_id = sa.tenant_id
     JOIN warehouses w ON sa.warehouse_id = w.id AND w.tenant_id = sa.tenant_id
     WHERE sa.id = ? AND sa.tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const create = async (data) => {
  const id = uuidv4();
  await query(
    `INSERT INTO stock_adjustments
     (id, tenant_id, warehouse_id, product_id, shade_id, batch_id, rack_id, adjustment_type, boxes, pieces, reason, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      id, data.tenant_id, data.warehouse_id, data.product_id, data.shade_id || null, data.batch_id || null, data.rack_id || null,
      data.adjustment_type, data.boxes ?? 0, data.pieces ?? 0, data.reason, data.created_by,
    ]
  );
  return id;
};

const update = async (id, tenantId, data) => {
  const updates = [];
  const params = [];
  ['warehouse_id', 'product_id', 'shade_id', 'batch_id', 'rack_id', 'adjustment_type', 'boxes', 'pieces', 'reason', 'status'].forEach((k) => {
    if (data[k] !== undefined) { updates.push(`${k} = ?`); params.push(data[k]); }
  });
  if (updates.length === 0) return;
  params.push(id, tenantId);
  await query(`UPDATE stock_adjustments SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
};

const setApproved = async (id, tenantId, approvedBy) => {
  await query(
    `UPDATE stock_adjustments SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ? AND tenant_id = ?`,
    [approvedBy, id, tenantId]
  );
};

const remove = async (id, tenantId) => {
  await query('DELETE FROM stock_adjustments WHERE id = ? AND tenant_id = ?', [id, tenantId]);
};

module.exports = { findAll, findById, create, update, setApproved, remove };
