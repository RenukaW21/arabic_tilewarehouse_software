'use strict';
const { query } = require('../../config/db');
const { parsePagination } = require('../../utils/pagination');

const SELECT_COLUMNS = 'id, tenant_id, name, email, role, phone, is_active, last_login_at, created_at, updated_at';

const findAll = async (tenantId, queryParams) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(
    queryParams,
    ['name', 'email', 'role', 'created_at', 'last_login_at']
  );
  const conditions = ['tenant_id = ?'];
  const params = [tenantId];

  // role: pre-parsed array from service (validated); when filtering by role, default to active only
  const roles = queryParams.role;
  if (roles && Array.isArray(roles) && roles.length > 0) {
    conditions.push(`role IN (${roles.map(() => '?').join(',')})`);
    params.push(...roles);
    if (queryParams.is_active === undefined || queryParams.is_active === '') {
      conditions.push('is_active = ?');
      params.push(1);
    }
  }
  if (queryParams.is_active !== undefined && queryParams.is_active !== '') {
    const active = queryParams.is_active === 'true' || queryParams.is_active === true;
    conditions.push('is_active = ?');
    params.push(active ? 1 : 0);
  }
  if (search) {
    conditions.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = conditions.join(' AND ');
  const orderDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const [rows, countResult] = await Promise.all([
    query(
      `SELECT ${SELECT_COLUMNS} FROM users WHERE ${where} ORDER BY ${sortBy} ${orderDir} LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    query(`SELECT COUNT(*) AS total FROM users WHERE ${where}`, params),
  ]);

  return { rows, total: countResult[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT ${SELECT_COLUMNS} FROM users WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const findByEmail = async (email, tenantId) => {
  const rows = await query(
    `SELECT id, tenant_id, name, email, password_hash, role, phone, is_active FROM users WHERE email = ? AND tenant_id = ?`,
    [email, tenantId]
  );
  return rows[0] || null;
};

const create = async (data) => {
  await query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, role, phone, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [data.id, data.tenant_id, data.name, data.email, data.password_hash, data.role, data.phone || null]
  );
  return data.id;
};

const update = async (id, tenantId, data) => {
  const allowed = ['name', 'role', 'phone', 'is_active', 'password_hash'];
  const setClause = [];
  const values = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      setClause.push(key === 'password_hash' ? 'password_hash = ?' : `${key} = ?`);
      values.push(data[key]);
    }
  }
  if (setClause.length === 0) return;
  values.push(id, tenantId);
  await query(
    `UPDATE users SET ${setClause.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    values
  );
};

module.exports = {
  findAll,
  findById,
  findByEmail,
  create,
  update,
};
