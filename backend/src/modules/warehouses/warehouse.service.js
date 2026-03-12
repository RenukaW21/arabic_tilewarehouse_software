'use strict';

const { getPool, query } = require('../../config/db');
const { parsePagination, buildSearchClause } = require('../../utils/pagination');

const SELECT_COLUMNS = [
  'id', 'tenant_id', 'name', 'code', 'address', 'city', 'state', 'pincode', 'is_active', 'created_at',
].join(', ');

const ALLOWED_SORT_FIELDS = ['name', 'code', 'created_at'];

const createWarehouse = async (data) => {
  const sql = `
    INSERT INTO warehouses (id, tenant_id, name, code, address, city, state, pincode, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const pool = getPool();
  await pool.execute(sql, [
    data.id,
    data.tenant_id,
    data.name,
    data.code,
    data.address ?? null,
    data.city ?? null,
    data.state ?? null,
    data.pincode ?? null,
    data.is_active !== false ? 1 : 0,
  ]);
};

const getAllWarehouses = async (tenantId, options = {}) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(options, ALLOWED_SORT_FIELDS);
  const conditions = ['w.tenant_id = ?'];
  const params = [tenantId];
  if (options.is_active !== undefined && options.is_active !== '') {
    conditions.push('w.is_active = ?');
    params.push(options.is_active === true || options.is_active === '1' || options.is_active === 'true' ? 1 : 0);
  }
  const { clause: searchClause, params: searchParams } = buildSearchClause(search, ['w.name', 'w.code']);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }
  const orderBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? `w.${sortBy}` : 'w.created_at';
  const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
  const whereSql = conditions.join(' AND ');
  
  const baseSql = `
    SELECT w.*, COUNT(r.id) as rack_count
    FROM warehouses w
    LEFT JOIN racks r ON w.id = r.warehouse_id AND r.is_active = 1
    WHERE ${whereSql}
    GROUP BY w.id
  `;

  const [rows, countResult] = await Promise.all([
    query(`${baseSql} ORDER BY ${orderBy} ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM warehouses w WHERE ${whereSql}`, params),
  ]);
  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getWarehouseById = async (id, tenantId) => {
  const rows = await query(
    `SELECT w.*, COUNT(r.id) as rack_count
     FROM warehouses w
     LEFT JOIN racks r ON w.id = r.warehouse_id AND r.is_active = 1
     WHERE w.id = ? AND w.tenant_id = ?
     GROUP BY w.id`,
    [id, tenantId]
  );
  return rows[0] ?? null;
};

const updateWarehouse = async (id, tenantId, fields) => {
  const allowed = ['name', 'code', 'address', 'city', 'state', 'pincode', 'is_active'];
  const setParts = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    setParts.push(`${key} = ?`);
    values.push(key === 'is_active' ? (fields[key] === true || fields[key] === 1 ? 1 : 0) : fields[key]);
  }
  if (setParts.length === 0) return null;
  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE warehouses SET ${setParts.join(', ')} WHERE id = ? AND tenant_id = ?`,
    [...values, id, tenantId]
  );
  if (result.affectedRows === 0) return null;
  return getWarehouseById(id, tenantId);
};

const deleteWarehouse = async (id, tenantId) => {
  const pool = getPool();
  const [result] = await pool.execute(
    'UPDATE warehouses SET is_active = 0 WHERE id = ? AND tenant_id = ?',
    [id, tenantId]
  );
  return result.affectedRows > 0;
};

module.exports = {
  createWarehouse,
  getAllWarehouses,
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse,
};
