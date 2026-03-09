'use strict';
const { query } = require('../../config/db');
const { parsePagination, buildSearchClause } = require('../../utils/pagination');

const ALLOWED_SORT = ['code', 'product_name', 'warehouse_name', 'total_boxes', 'total_pieces', 'total_sqft', 'updated_at'];

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ALLOWED_SORT);
  const conditions = ['ss.tenant_id = ?'];
  const params = [tenantId];

  const { clause: searchClause, params: searchParams } = buildSearchClause(search, ['p.name', 'p.code']);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }

  const sortColumnMap = {
    code: 'p.code',
    product_name: 'p.name',
    warehouse_name: 'w.name',
    total_boxes: 'ss.total_boxes',
    total_pieces: 'ss.total_pieces',
    total_sqft: 'ss.total_sqft',
    updated_at: 'ss.updated_at',
  };
  const orderBy = sortColumnMap[sortBy] || 'ss.updated_at';
  const whereSql = conditions.join(' AND ');

  const baseSql = `
    SELECT ss.id, ss.tenant_id, ss.warehouse_id, ss.rack_id, ss.product_id, ss.shade_id, ss.batch_id,
           ss.total_boxes, ss.total_pieces, ss.total_sqft, ss.avg_cost_per_box, ss.updated_at,
           p.code, p.name AS product_name, p.sqft_per_box,
           w.name AS warehouse_name
    FROM stock_summary ss
    JOIN products p ON ss.product_id = p.id AND p.tenant_id = ss.tenant_id
    JOIN warehouses w ON ss.warehouse_id = w.id AND w.tenant_id = ss.tenant_id
    WHERE ${whereSql}
  `;

  const [rows, countRows] = await Promise.all([
    query(`${baseSql} ORDER BY ${orderBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM stock_summary ss JOIN products p ON ss.product_id = p.id AND p.tenant_id = ss.tenant_id JOIN warehouses w ON ss.warehouse_id = w.id AND w.tenant_id = ss.tenant_id WHERE ${whereSql}`, params),
  ]);

  return { rows, total: countRows[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT ss.*, p.code, p.name AS product_name, p.sqft_per_box,
            w.name AS warehouse_name
     FROM stock_summary ss
     JOIN products p ON ss.product_id = p.id AND p.tenant_id = ss.tenant_id
     JOIN warehouses w ON ss.warehouse_id = w.id AND w.tenant_id = ss.tenant_id
     WHERE ss.id = ? AND ss.tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const getSummaryRowForUpdate = async (trx, id, tenantId) => {
  const rows = await trx.query(
    `SELECT id, tenant_id, warehouse_id, rack_id, product_id, shade_id, batch_id,
            total_boxes, total_pieces, total_sqft
     FROM stock_summary
     WHERE id = ? AND tenant_id = ?
     FOR UPDATE`,
    [id, tenantId]
  );
  return rows[0] || null;
};

module.exports = {
  findAll,
  findById,
  getSummaryRowForUpdate,
};
