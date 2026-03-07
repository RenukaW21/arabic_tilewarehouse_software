'use strict';

const { getPool, query } = require('../../config/db');
const { parsePagination, buildSearchClause, buildFilterClauses } = require('../../utils/pagination');

// MySQL reserved word: use backticks for `row`
const SELECT_COLUMNS = [
  'id', 'tenant_id', 'warehouse_id', 'name', 'aisle', '`row`', 'level',
  'capacity_boxes', 'qr_code', 'is_active', 'created_at',
].join(', ');

const ALLOWED_SORT_FIELDS = ['name', 'aisle', 'created_at'];

const createRack = async (data) => {
  const sql = `
    INSERT INTO racks (id, tenant_id, warehouse_id, name, aisle, \`row\`, level, capacity_boxes, qr_code, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const pool = getPool();
  await pool.execute(sql, [
    data.id,
    data.tenant_id,
    data.warehouse_id,
    data.name,
    data.aisle ?? null,
    data.row ?? null,
    data.level ?? null,
    data.capacity_boxes ?? null,
    data.qr_code ?? null,
    data.is_active !== false ? 1 : 0,
  ]);
};

const getAllRacks = async (tenantId, options = {}) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(options, ALLOWED_SORT_FIELDS);
  const conditions = ['tenant_id = ?'];
  const params = [tenantId];

  const filterMap = {};
  if (options.is_active !== undefined && options.is_active !== '') {
    filterMap.is_active = options.is_active === true || options.is_active === '1' || options.is_active === 'true' ? 1 : 0;
  }
  if (options.warehouse_id) filterMap.warehouse_id = options.warehouse_id;
  const { clauses: filterClauses, params: filterParams } = buildFilterClauses(filterMap);
  if (filterClauses.length) {
    conditions.push(...filterClauses);
    params.push(...filterParams);
  }

  const { clause: searchClause, params: searchParams } = buildSearchClause(search, ['name', 'aisle']);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }

  const orderBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
  const whereSql = conditions.join(' AND ');
  const baseSql = `SELECT ${SELECT_COLUMNS} FROM racks WHERE ${whereSql}`;
  // LIMIT/OFFSET interpolated (validated integers) — MySQL 8.0.22+ rejects them as bound params
  const [rows, countResult] = await Promise.all([
    query(`${baseSql} ORDER BY ${orderBy} ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM racks WHERE ${whereSql}`, params),
  ]);
  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getRackById = async (id, tenantId) => {
  const rows = await query(
    `SELECT ${SELECT_COLUMNS} FROM racks WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] ?? null;
};

const updateRack = async (id, tenantId, fields) => {
  const allowed = ['warehouse_id', 'name', 'aisle', 'row', 'level', 'capacity_boxes', 'qr_code', 'is_active'];
  const setParts = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    const col = key === 'row' ? '`row`' : key;
    setParts.push(`${col} = ?`);
    values.push(key === 'is_active' ? (fields[key] === true || fields[key] === 1 ? 1 : 0) : fields[key]);
  }
  if (setParts.length === 0) return null;
  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE racks SET ${setParts.join(', ')} WHERE id = ? AND tenant_id = ?`,
    [...values, id, tenantId]
  );
  if (result.affectedRows === 0) return null;
  return getRackById(id, tenantId);
};

const deleteRack = async (id, tenantId) => {
  const pool = getPool();
  const [result] = await pool.execute(
    'UPDATE racks SET is_active = 0 WHERE id = ? AND tenant_id = ?',
    [id, tenantId]
  );
  return result.affectedRows > 0;
};

module.exports = {
  createRack,
  getAllRacks,
  getRackById,
  updateRack,
  deleteRack,
};
