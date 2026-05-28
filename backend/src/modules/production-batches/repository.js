'use strict';

const { query } = require('../../config/db');
const { parsePagination, buildSearchClause, buildFilterClauses } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_SORT = ['batch_number', 'start_date', 'created_at', 'status'];
const run = (trx, sql, params) => (trx ? trx.query(sql, params) : query(sql, params));

// ─── LIST ─────────────────────────────────────────────────────────────────────

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ALLOWED_SORT);

  const conditions = ['b.tenant_id = ?'];
  const params = [tenantId];

  const { clauses, params: fp } = buildFilterClauses({
    'b.status':              queryParams.status,
    'b.warehouse_id':        queryParams.warehouse_id,
    'b.production_order_id': queryParams.production_order_id,
  });
  conditions.push(...clauses);
  params.push(...fp);

  if (search) {
    const { clause, params: sp } = buildSearchClause(search, ['b.batch_number', 'p.name', 'po.order_number']);
    if (clause) { conditions.push(clause); params.push(...sp); }
  }

  const where = conditions.join(' AND ');
  const baseSql = `
    SELECT b.*,
           w.name  AS warehouse_name,
           p.name  AS product_name,
           p.code  AS product_code,
           po.order_number AS production_order_number
    FROM production_batches b
    LEFT JOIN warehouses        w  ON w.id  = b.warehouse_id
    LEFT JOIN products          p  ON p.id  = b.product_id
    LEFT JOIN production_orders po ON po.id = b.production_order_id
    WHERE ${where}`;

  const [rows, countRows] = await Promise.all([
    query(`${baseSql} ORDER BY b.${sortBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM production_batches b
           LEFT JOIN products          p  ON p.id  = b.product_id
           LEFT JOIN production_orders po ON po.id = b.production_order_id
           WHERE ${where}`, params),
  ]);

  return { rows, total: Number(countRows[0].total) };
};

// ─── FIND BY ID ───────────────────────────────────────────────────────────────

const findById = async (id, tenantId, trx) => {
  const rows = await run(trx, `
    SELECT b.*,
           w.name  AS warehouse_name,
           p.name  AS product_name,
           p.code  AS product_code,
           po.order_number AS production_order_number
    FROM production_batches b
    LEFT JOIN warehouses        w  ON w.id  = b.warehouse_id
    LEFT JOIN products          p  ON p.id  = b.product_id
    LEFT JOIN production_orders po ON po.id = b.production_order_id
    WHERE b.id = ? AND b.tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

// ─── CREATE ───────────────────────────────────────────────────────────────────

const create = async (data, trx) => {
  const id = uuidv4();
  await run(trx, `
    INSERT INTO production_batches
      (id, tenant_id, batch_number, production_order_id, status, warehouse_id,
       product_id, quantity_planned, quantity_produced, wastage_qty,
       start_date, end_date, notes, created_by)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, 0, 0, ?, NULL, ?, ?)`,
    [id, data.tenant_id, data.batch_number,
     data.production_order_id || null,
     data.warehouse_id,
     data.product_id || null,
     data.quantity_planned || 0,
     data.start_date || null,
     data.notes || null,
     data.created_by]
  );
  return id;
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────

const update = async (id, tenantId, fields, trx) => {
  const allowed = ['production_order_id','warehouse_id','product_id','status',
                   'quantity_planned','quantity_produced','wastage_qty',
                   'start_date','end_date','notes'];
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k) && v !== undefined) {
      sets.push(`\`${k}\` = ?`);
      params.push(v);
    }
  }
  if (!sets.length) return;
  params.push(id, tenantId);
  await run(trx, `UPDATE production_batches SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
};

// ─── DELETE ───────────────────────────────────────────────────────────────────

const deleteBatch = async (id, tenantId, trx) =>
  run(trx, `DELETE FROM production_batches WHERE id = ? AND tenant_id = ?`, [id, tenantId]);

module.exports = { findAll, findById, create, update, deleteBatch };
