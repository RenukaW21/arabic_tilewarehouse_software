'use strict';

const { getPool, query } = require('../../config/db');
const { checkCustomerLinked } = require('../../utils/deleteGuard');
const { parsePagination, buildSearchClause } = require('../../utils/pagination');

const SELECT_COLUMNS = [
  'id', 'tenant_id', 'name', 'code', 'contact_person', 'phone', 'email',
  'billing_address', 'shipping_address', 'gstin', 'state_code',
  'credit_limit', 'payment_terms_days', 'is_active', 'created_at',
].join(', ');

const ALLOWED_SORT_FIELDS = ['name', 'code', 'created_at'];

const createCustomer = async (data) => {
  const sql = `
    INSERT INTO customers (
      id, tenant_id, name, code, contact_person, phone, email,
      billing_address, shipping_address, gstin, state_code,
      credit_limit, payment_terms_days, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const pool = getPool();
  await pool.execute(sql, [
    data.id,
    data.tenant_id,
    data.name,
    data.code ?? null,
    data.contact_person ?? null,
    data.phone ?? null,
    data.email ?? null,
    data.billing_address ?? null,
    data.shipping_address ?? null,
    data.gstin ?? null,
    data.state_code ?? null,
    data.credit_limit ?? 0,
    data.payment_terms_days ?? 0,
    data.is_active !== false ? 1 : 0,
  ]);
};

const getAllCustomers = async (tenantId, options = {}) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(
    options,
    ALLOWED_SORT_FIELDS
  );

  const conditions = ['tenant_id = ?'];
  const params = [tenantId];

  if (options.is_active !== undefined && options.is_active !== '') {
    conditions.push('is_active = ?');
    const active = options.is_active === true || options.is_active === '1' || options.is_active === 'true';
    params.push(active ? 1 : 0);
  }

  const searchColumns = ['name', 'code'];
  const { clause: searchClause, params: searchParams } = buildSearchClause(search, searchColumns);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }

  const orderBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
  const whereSql = conditions.join(' AND ');
  const baseSql = `SELECT ${SELECT_COLUMNS} FROM customers WHERE ${whereSql}`;

  // LIMIT/OFFSET interpolated (validated integers) — MySQL 8.0.22+ rejects them as bound params
  const [rows, countResult] = await Promise.all([
    query(`${baseSql} ORDER BY ${orderBy} ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM customers WHERE ${whereSql}`, params),
  ]);

  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getCustomerById = async (id, tenantId) => {
  const rows = await query(
    `SELECT ${SELECT_COLUMNS} FROM customers WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] ?? null;
};

const updateCustomer = async (id, tenantId, fields) => {
  const allowed = [
    'name', 'code', 'contact_person', 'phone', 'email',
    'billing_address', 'shipping_address', 'gstin', 'state_code',
    'credit_limit', 'payment_terms_days', 'is_active',
  ];
  const setParts = [];
  const values = [];

  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    setParts.push(`${key} = ?`);
    if (key === 'is_active') {
      values.push(fields[key] === true || fields[key] === 1 ? 1 : 0);
    } else {
      values.push(fields[key]);
    }
  }

  if (setParts.length === 0) return null;

  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE customers SET ${setParts.join(', ')} WHERE id = ? AND tenant_id = ?`,
    [...values, id, tenantId]
  );

  if (result.affectedRows === 0) return null;
  return getCustomerById(id, tenantId);
};

/**
 * Hard delete. Throws if customer is linked to sales_orders, invoices, delivery_challans, sales_returns, credit_notes, customer_payments.
 * Use updateCustomer(id, tenantId, { is_active: 0 }) for deactivate (toggle).
 */
const deleteCustomer = async (id, tenantId) => {
  await checkCustomerLinked(id, tenantId);
  const pool = getPool();
  const [result] = await pool.execute(
    'DELETE FROM customers WHERE id = ? AND tenant_id = ?',
    [id, tenantId]
  );
  return result.affectedRows > 0;
};

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};
