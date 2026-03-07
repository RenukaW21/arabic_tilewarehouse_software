'use strict';

const { getPool, query } = require('../../config/db');
const { checkVendorLinked } = require('../../utils/deleteGuard');
const { parsePagination, buildSearchClause, buildFilterClauses } = require('../../utils/pagination');

/** Columns selected for list/get — avoid SELECT * for performance */
const SELECT_COLUMNS = [
  'id', 'tenant_id', 'name', 'code', 'contact_person', 'phone', 'email',
  'address', 'gstin', 'pan', 'payment_terms_days', 'is_active', 'created_at',
].join(', ');

const ALLOWED_SORT_FIELDS = ['name', 'code', 'created_at'];

/**
 * Create a new vendor. tenant_id must come from JWT, never from body.
 */
const createVendor = async (data) => {
  const sql = `
    INSERT INTO vendors (
      id, tenant_id, name, code, contact_person, phone, email,
      address, gstin, pan, payment_terms_days, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    data.address ?? null,
    data.gstin ?? null,
    data.pan ?? null,
    data.payment_terms_days ?? 30,
    data.is_active !== false ? 1 : 0,
  ]);
};

/**
 * Get all vendors with pagination, search (name/code), filters, and sorting.
 */
const getAllVendors = async (tenantId, options = {}) => {
  const { page, limit, offset, sortBy, sortOrder, search } = parsePagination(
    options,
    ALLOWED_SORT_FIELDS
  );

  const conditions = ['tenant_id = ?'];
  const params = [tenantId];

  // Optional: filter by is_active
  if (options.is_active !== undefined && options.is_active !== '') {
    conditions.push('is_active = ?');
    params.push(options.is_active === true || options.is_active === '1' || options.is_active === 'true' ? 1 : 0);
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
  const baseSql = `SELECT ${SELECT_COLUMNS} FROM vendors WHERE ${whereSql}`;

  // LIMIT/OFFSET interpolated (validated integers) — MySQL 8.0.22+ rejects them as bound params
  const [rows, countResult] = await Promise.all([
    query(`${baseSql} ORDER BY ${orderBy} ${order} LIMIT ${limit} OFFSET ${offset}`, params),
    query(`SELECT COUNT(*) AS total FROM vendors WHERE ${whereSql}`, params),
  ]);

  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

/**
 * Get a single vendor by id. Returns null if not found or tenant mismatch.
 */
const getVendorById = async (id, tenantId) => {
  const rows = await query(
    `SELECT ${SELECT_COLUMNS} FROM vendors WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] ?? null;
};

/**
 * Update vendor. Only allowed fields are updated; tenant_id is never changed.
 */
const updateVendor = async (id, tenantId, fields) => {
  const allowed = [
    'name', 'code', 'contact_person', 'phone', 'email', 'address',
    'gstin', 'pan', 'payment_terms_days', 'is_active',
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
    `UPDATE vendors SET ${setParts.join(', ')} WHERE id = ? AND tenant_id = ?`,
    [...values, id, tenantId]
  );

  if (result.affectedRows === 0) return null;
  return getVendorById(id, tenantId);
};

/**
 * Hard delete. Throws if vendor is linked to purchase_orders, grn, purchase_returns, debit_notes, vendor_payments.
 * Use updateVendor(id, tenantId, { is_active: 0 }) for deactivate (toggle).
 */
const deleteVendor = async (id, tenantId) => {
  await checkVendorLinked(id, tenantId);
  const pool = getPool();
  const [result] = await pool.execute(
    'DELETE FROM vendors WHERE id = ? AND tenant_id = ?',
    [id, tenantId]
  );
  return result.affectedRows > 0;
};

module.exports = {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
};
