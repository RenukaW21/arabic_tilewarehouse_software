'use strict';

const { query } = require('../../config/db');
const { parsePagination, buildSearchClause, buildFilterClauses } = require('../../utils/pagination');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_SORT = ['order_number', 'planned_date', 'created_at', 'status'];

const run = (trx, sql, params) => (trx ? trx.query(sql, params) : query(sql, params));

// ─── LIST ─────────────────────────────────────────────────────────────────────

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ALLOWED_SORT);

  const conditions = ['po.tenant_id = ?'];
  const params = [tenantId];

  const { clauses: filterClauses, params: filterParams } = buildFilterClauses({
    'po.status':       queryParams.status,
    'po.warehouse_id': queryParams.warehouse_id,
  });
  conditions.push(...filterClauses);
  params.push(...filterParams);

  if (search) {
    const { clause, params: sp } = buildSearchClause(search, ['po.order_number', 'w.name']);
    if (clause) { conditions.push(clause); params.push(...sp); }
  }

  const where = conditions.join(' AND ');
  const baseSql = `
    SELECT po.*,
           w.name  AS warehouse_name,
           u.name  AS created_by_name,
           (SELECT COUNT(*) FROM production_order_materials   m WHERE m.production_order_id = po.id) AS material_count,
           (SELECT COUNT(*) FROM production_order_outputs     o WHERE o.production_order_id = po.id) AS output_count
    FROM production_orders po
    LEFT JOIN warehouses w ON w.id = po.warehouse_id
    LEFT JOIN users      u ON u.id = po.created_by
    WHERE ${where}`;

  const [rows, countRows] = await Promise.all([
    query(`${baseSql} ORDER BY po.${sortBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM production_orders po LEFT JOIN warehouses w ON w.id = po.warehouse_id WHERE ${where}`, params),
  ]);

  return { rows, total: Number(countRows[0].total) };
};

// ─── FIND BY ID ───────────────────────────────────────────────────────────────

const findById = async (id, tenantId, trx) => {
  const rows = await run(trx,
    `SELECT po.*, w.name AS warehouse_name
     FROM production_orders po
     LEFT JOIN warehouses w ON w.id = po.warehouse_id
     WHERE po.id = ? AND po.tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const findMaterials = async (orderId, tenantId, trx) => run(trx,
  `SELECT m.*, p.name AS product_name, p.code AS product_code
   FROM production_order_materials m
   LEFT JOIN products p ON p.id = m.product_id
   WHERE m.production_order_id = ? AND m.tenant_id = ?
   ORDER BY m.created_at ASC`,
  [orderId, tenantId]
);

const findOutputs = async (orderId, tenantId, trx) => run(trx,
  `SELECT o.*, p.name AS product_name, p.code AS product_code
   FROM production_order_outputs o
   LEFT JOIN products p ON p.id = o.product_id
   WHERE o.production_order_id = ? AND o.tenant_id = ?
   ORDER BY o.created_at ASC`,
  [orderId, tenantId]
);

// ─── CREATE ───────────────────────────────────────────────────────────────────

const createOrder = async (data, trx) => {
  const id = uuidv4();
  await run(trx,
    `INSERT INTO production_orders
       (id, tenant_id, order_number, status, warehouse_id, planned_date,
        labor_cost, machine_cost, wastage_cost, total_material_cost, total_cost, notes, created_by)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [id, data.tenant_id, data.order_number, data.warehouse_id, data.planned_date,
     data.labor_cost || 0, data.machine_cost || 0, data.wastage_cost || 0,
     (data.labor_cost || 0) + (data.machine_cost || 0) + (data.wastage_cost || 0),
     data.notes || null, data.created_by]
  );
  return id;
};

const createMaterial = async (data, trx) => {
  const id = uuidv4();
  const lineTotal = (data.actual_qty || data.planned_qty || 0) * (data.unit_cost || 0);
  await run(trx,
    `INSERT INTO production_order_materials
       (id, production_order_id, tenant_id, product_id, planned_qty, actual_qty, unit_cost, line_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.production_order_id, data.tenant_id, data.product_id,
     data.planned_qty || 0, data.actual_qty || 0, data.unit_cost || 0, lineTotal]
  );
  return id;
};

const createOutput = async (data, trx) => {
  const id = uuidv4();
  const lineTotal = (data.actual_qty || data.planned_qty || 0) * (data.unit_cost || 0);
  await run(trx,
    `INSERT INTO production_order_outputs
       (id, production_order_id, tenant_id, product_id, planned_qty, actual_qty, wastage_qty, unit_cost, line_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.production_order_id, data.tenant_id, data.product_id,
     data.planned_qty || 0, data.actual_qty || 0, data.wastage_qty || 0, data.unit_cost || 0, lineTotal]
  );
  return id;
};

// ─── CROSS-ORDER LISTS (for dedicated pages) ──────────────────────────────────

const findAllMaterials = async (tenantId, queryParams) => {
  const { parsePagination, buildSearchClause } = require('../../utils/pagination');
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ['created_at', 'product_name', 'planned_qty']);

  const conditions = ['m.tenant_id = ?'];
  const params = [tenantId];

  if (queryParams.production_order_id) {
    conditions.push('m.production_order_id = ?');
    params.push(queryParams.production_order_id);
  }
  if (queryParams.product_id) {
    conditions.push('m.product_id = ?');
    params.push(queryParams.product_id);
  }
  if (search) {
    const { clause, params: sp } = buildSearchClause(search, ['p.name', 'p.code', 'po.order_number']);
    if (clause) { conditions.push(clause); params.push(...sp); }
  }

  const where = conditions.join(' AND ');
  const baseSql = `
    SELECT m.*,
           p.name         AS product_name,
           p.code         AS product_code,
           po.order_number AS order_number,
           po.status       AS order_status,
           w.name          AS warehouse_name
    FROM production_order_materials m
    LEFT JOIN products          p  ON p.id  = m.product_id
    LEFT JOIN production_orders po ON po.id = m.production_order_id
    LEFT JOIN warehouses        w  ON w.id  = po.warehouse_id
    WHERE ${where}`;

  const [rows, countRows] = await Promise.all([
    query(`${baseSql} ORDER BY m.created_at ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM production_order_materials m
           LEFT JOIN products p ON p.id = m.product_id
           LEFT JOIN production_orders po ON po.id = m.production_order_id
           WHERE ${where}`, params),
  ]);
  return { rows, total: Number(countRows[0].total) };
};

const findAllOutputs = async (tenantId, queryParams) => {
  const { parsePagination, buildSearchClause } = require('../../utils/pagination');
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ['created_at', 'product_name', 'planned_qty']);

  const conditions = ['o.tenant_id = ?'];
  const params = [tenantId];

  if (queryParams.production_order_id) {
    conditions.push('o.production_order_id = ?');
    params.push(queryParams.production_order_id);
  }
  if (queryParams.product_id) {
    conditions.push('o.product_id = ?');
    params.push(queryParams.product_id);
  }
  if (search) {
    const { clause, params: sp } = buildSearchClause(search, ['p.name', 'p.code', 'po.order_number']);
    if (clause) { conditions.push(clause); params.push(...sp); }
  }

  const where = conditions.join(' AND ');
  const baseSql = `
    SELECT o.*,
           p.name          AS product_name,
           p.code          AS product_code,
           po.order_number AS order_number,
           po.status       AS order_status,
           w.name          AS warehouse_name
    FROM production_order_outputs o
    LEFT JOIN products          p  ON p.id  = o.product_id
    LEFT JOIN production_orders po ON po.id = o.production_order_id
    LEFT JOIN warehouses        w  ON w.id  = po.warehouse_id
    WHERE ${where}`;

  const [rows, countRows] = await Promise.all([
    query(`${baseSql} ORDER BY o.created_at ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM production_order_outputs o
           LEFT JOIN products p ON p.id = o.product_id
           LEFT JOIN production_orders po ON po.id = o.production_order_id
           WHERE ${where}`, params),
  ]);
  return { rows, total: Number(countRows[0].total) };
};

const getCostSummary = async (tenantId, queryParams) => {
  const { parsePagination } = require('../../utils/pagination');
  const { page, limit, offset, sortOrder } = parsePagination(queryParams, ['created_at']);

  const conditions = ['po.tenant_id = ?'];
  const params = [tenantId];

  if (queryParams.status)       { conditions.push('po.status = ?');       params.push(queryParams.status); }
  if (queryParams.warehouse_id) { conditions.push('po.warehouse_id = ?'); params.push(queryParams.warehouse_id); }
  if (queryParams.from_date)    { conditions.push('po.planned_date >= ?'); params.push(queryParams.from_date); }
  if (queryParams.to_date)      { conditions.push('po.planned_date <= ?'); params.push(queryParams.to_date); }

  const where = conditions.join(' AND ');
  const baseSql = `
    SELECT po.id, po.order_number, po.status, po.planned_date, po.completion_date,
           po.labor_cost, po.machine_cost, po.wastage_cost,
           po.total_material_cost, po.total_cost,
           w.name AS warehouse_name
    FROM production_orders po
    LEFT JOIN warehouses w ON w.id = po.warehouse_id
    WHERE ${where}`;

  const [rows, countRows, totals] = await Promise.all([
    query(`${baseSql} ORDER BY po.created_at ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM production_orders po WHERE ${where}`, params),
    query(`SELECT
             COALESCE(SUM(labor_cost), 0)          AS total_labor,
             COALESCE(SUM(machine_cost), 0)        AS total_machine,
             COALESCE(SUM(wastage_cost), 0)        AS total_wastage,
             COALESCE(SUM(total_material_cost), 0) AS total_material,
             COALESCE(SUM(total_cost), 0)          AS grand_total
           FROM production_orders po WHERE ${where}`, params),
  ]);

  return { rows, total: Number(countRows[0].total), summary: totals[0] };
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────

const updateOrder = async (id, tenantId, fields, trx) => {
  const allowed = ['warehouse_id','planned_date','completion_date','status',
                   'labor_cost','machine_cost','wastage_cost','total_material_cost','total_cost','notes'];
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
  await run(trx, `UPDATE production_orders SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
};

// Recalculate total_material_cost and total_cost from line items
const recalcTotals = async (id, tenantId, trx) => {
  const [mat] = await run(trx,
    `SELECT COALESCE(SUM(line_total),0) AS mat_total FROM production_order_materials WHERE production_order_id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  const [hdr] = await run(trx,
    `SELECT labor_cost, machine_cost, wastage_cost FROM production_orders WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  const matTotal = parseFloat(mat.mat_total) || 0;
  const totalCost = matTotal +
    (parseFloat(hdr?.labor_cost) || 0) +
    (parseFloat(hdr?.machine_cost) || 0) +
    (parseFloat(hdr?.wastage_cost) || 0);
  await run(trx,
    `UPDATE production_orders SET total_material_cost = ?, total_cost = ? WHERE id = ? AND tenant_id = ?`,
    [matTotal, totalCost, id, tenantId]
  );
};

// Replace all materials / outputs for an order
const replaceMaterials = async (orderId, tenantId, items, trx) => {
  await run(trx, `DELETE FROM production_order_materials WHERE production_order_id = ? AND tenant_id = ?`, [orderId, tenantId]);
  for (const item of items) {
    await createMaterial({ ...item, production_order_id: orderId, tenant_id: tenantId }, trx);
  }
};

const replaceOutputs = async (orderId, tenantId, items, trx) => {
  await run(trx, `DELETE FROM production_order_outputs WHERE production_order_id = ? AND tenant_id = ?`, [orderId, tenantId]);
  for (const item of items) {
    await createOutput({ ...item, production_order_id: orderId, tenant_id: tenantId }, trx);
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────

const deleteOrder = async (id, tenantId, trx) => {
  await run(trx, `DELETE FROM production_order_materials WHERE production_order_id = ? AND tenant_id = ?`, [id, tenantId]);
  await run(trx, `DELETE FROM production_order_outputs   WHERE production_order_id = ? AND tenant_id = ?`, [id, tenantId]);
  await run(trx, `DELETE FROM production_orders WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
};

module.exports = {
  findAll, findById, findMaterials, findOutputs,
  findAllMaterials, findAllOutputs, getCostSummary,
  createOrder, createMaterial, createOutput,
  updateOrder, recalcTotals, replaceMaterials, replaceOutputs,
  deleteOrder,
};
