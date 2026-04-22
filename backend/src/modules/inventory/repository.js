'use strict';
const { query } = require('../../config/db');
const { parsePagination, buildSearchClause } = require('../../utils/pagination');

const ALLOWED_SORT = ['code', 'product_name', 'warehouse_name', 'total_boxes', 'total_pieces', 'total_sqft', 'updated_at'];

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(queryParams, ALLOWED_SORT);
  const conditions = ['ss.tenant_id = ?'];
  const params = [tenantId];

  if (queryParams.warehouse_id) {
    conditions.push('ss.warehouse_id = ?');
    params.push(queryParams.warehouse_id);
  }


  const { clause: searchClause, params: searchParams } = buildSearchClause(search, ['p.name', 'p.code']);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }

  const sortColumnMap = {
    code: 'code',
    product_name: 'product_name',
    warehouse_name: 'warehouse_name',
    total_boxes: 'total_boxes',
    total_pieces: 'total_pieces',
    total_sqft: 'total_sqft',
    updated_at: 'updated_at',
  };
  const orderBy = sortColumnMap[sortBy] || 'updated_at';
  const whereSql = conditions.join(' AND ');

  const baseSql = `
    SELECT MIN(ss.id) AS id,
           ss.tenant_id,
           ss.warehouse_id AS warehouse_id,
           NULL AS rack_id,
           ss.product_id,
           NULL AS shade_id,
           NULL AS batch_id,
           SUM(ss.total_boxes) AS total_boxes,
           SUM(ss.total_pieces) AS total_pieces,
           SUM(ss.total_sqft) AS total_sqft,
           CASE
             WHEN SUM(ss.total_boxes) > 0
               THEN SUM(ss.total_boxes * COALESCE(ss.avg_cost_per_box, 0)) / SUM(ss.total_boxes)
             ELSE NULL
           END AS avg_cost_per_box,
           MAX(ss.updated_at) AS updated_at,
           p.code, p.name AS product_name, p.sqft_per_box,
           MAX(w.name) AS warehouse_name,
           COALESCE(SUM(res.reserved_boxes), 0) AS reserved_boxes,
           GREATEST(0, SUM(ss.total_boxes) - COALESCE(SUM(res.reserved_boxes), 0)) AS available_boxes
    FROM stock_summary ss
    JOIN products p ON ss.product_id = p.id AND p.tenant_id = ss.tenant_id
    JOIN warehouses w ON ss.warehouse_id = w.id AND w.tenant_id = ss.tenant_id
    LEFT JOIN (
      SELECT tenant_id, warehouse_id, product_id, shade_id, batch_id,
             SUM(boxes_reserved) AS reserved_boxes
      FROM stock_reservations
      GROUP BY tenant_id, warehouse_id, product_id, shade_id, batch_id
    ) res ON res.tenant_id = ss.tenant_id
          AND res.warehouse_id = ss.warehouse_id
          AND res.product_id = ss.product_id
          AND (res.shade_id <=> ss.shade_id)
          AND (res.batch_id <=> ss.batch_id)
    WHERE ${whereSql}
    GROUP BY ss.tenant_id, ss.warehouse_id, ss.product_id, p.code, p.name, p.sqft_per_box
  `;

  const [rows, countRows] = await Promise.all([
    query(`${baseSql} ORDER BY ${orderBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`, params),
    query(
      `SELECT COUNT(*) AS total
       FROM (
         SELECT ss.product_id
         FROM stock_summary ss
         JOIN products p ON ss.product_id = p.id AND p.tenant_id = ss.tenant_id
         JOIN warehouses w ON ss.warehouse_id = w.id AND w.tenant_id = ss.tenant_id
         WHERE ${whereSql}
         GROUP BY ss.product_id, ss.warehouse_id
       ) grouped_stock`,
      params
    ),
  ]);

  return { rows, total: countRows[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT ss.*, p.code, p.name AS product_name, p.sqft_per_box,
            w.name AS warehouse_name,
            COALESCE(res.reserved_boxes, 0) AS reserved_boxes,
            GREATEST(0, ss.total_boxes - COALESCE(res.reserved_boxes, 0)) AS available_boxes
     FROM stock_summary ss
     JOIN products p ON ss.product_id = p.id AND p.tenant_id = ss.tenant_id
     JOIN warehouses w ON ss.warehouse_id = w.id AND w.tenant_id = ss.tenant_id
     LEFT JOIN (
       SELECT tenant_id, warehouse_id, product_id, shade_id, batch_id,
              SUM(boxes_reserved) AS reserved_boxes
       FROM stock_reservations
       GROUP BY tenant_id, warehouse_id, product_id, shade_id, batch_id
     ) res ON res.tenant_id = ss.tenant_id
           AND res.warehouse_id = ss.warehouse_id
           AND res.product_id = ss.product_id
           AND (res.shade_id <=> ss.shade_id)
           AND (res.batch_id <=> ss.batch_id)
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
