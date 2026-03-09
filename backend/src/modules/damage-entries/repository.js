'use strict';
const { query } = require('../../config/db');
const { parsePagination, buildSearchClause } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_SORT = ['damage_date', 'created_at', 'damaged_boxes'];

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ALLOWED_SORT);
  const conditions = ['de.tenant_id = ?'];
  const params = [tenantId];
  const { clause: searchClause, params: searchParams } = buildSearchClause(search, ['de.damage_reason', 'p.name', 'p.code']);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }
  const orderBy = ALLOWED_SORT.includes(sortBy) ? sortBy : 'created_at';
  const whereSql = conditions.join(' AND ');
  const baseSql = `
    SELECT de.*, p.name AS product_name, p.code AS product_code, w.name AS warehouse_name
    FROM damage_entries de
    JOIN products p ON de.product_id = p.id AND p.tenant_id = de.tenant_id
    JOIN warehouses w ON de.warehouse_id = w.id AND w.tenant_id = de.tenant_id
    WHERE ${whereSql}
  `;
  const [rows, countRows] = await Promise.all([
    query(`${baseSql} ORDER BY de.${orderBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM damage_entries de JOIN products p ON de.product_id = p.id AND p.tenant_id = de.tenant_id WHERE ${whereSql}`, params),
  ]);
  return { rows, total: countRows[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT de.*, p.name AS product_name, p.code AS product_code, w.name AS warehouse_name
     FROM damage_entries de
     JOIN products p ON de.product_id = p.id AND p.tenant_id = de.tenant_id
     JOIN warehouses w ON de.warehouse_id = w.id AND w.tenant_id = de.tenant_id
     WHERE de.id = ? AND de.tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const create = async (trx, data) => {
  const id = uuidv4();
  const run = trx ? (sql, p) => trx.query(sql, p) : (sql, p) => query(sql, p);
  await run(
    `INSERT INTO damage_entries
     (id, tenant_id, warehouse_id, product_id, shade_id, batch_id, rack_id, damage_date,
      damaged_boxes, damaged_pieces, damage_reason, estimated_loss, created_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.tenant_id, data.warehouse_id, data.product_id, data.shade_id || null, data.batch_id || null, data.rack_id || null,
      data.damage_date || new Date(),
      data.damaged_boxes ?? 0, data.damaged_pieces ?? 0,
      data.damage_reason || null, data.estimated_loss ?? null, data.created_by, data.notes || null,
    ]
  );
  return id;
};

const update = async (id, tenantId, data) => {
  const updates = [];
  const params = [];
  ['warehouse_id', 'product_id', 'shade_id', 'batch_id', 'rack_id', 'damage_date', 'damaged_boxes', 'damaged_pieces', 'damage_reason', 'estimated_loss', 'notes'].forEach((k) => {
    if (data[k] !== undefined) { updates.push(`${k} = ?`); params.push(data[k]); }
  });
  if (updates.length === 0) return;
  params.push(id, tenantId);
  await query(`UPDATE damage_entries SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
};

const remove = async (id, tenantId) => {
  await query('DELETE FROM damage_entries WHERE id = ? AND tenant_id = ?', [id, tenantId]);
};

module.exports = { findAll, findById, create, update, remove };
