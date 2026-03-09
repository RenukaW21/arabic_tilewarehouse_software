'use strict';
const { query, beginTransaction } = require('../../config/db');

const findUserByEmail = async (email, tenantId) => {
  const rows = await query(
    `SELECT u.*, t.status AS tenant_status, t.slug AS tenant_slug
     FROM users u JOIN tenants t ON u.tenant_id = t.id
     WHERE u.email = ? AND u.tenant_id = ? AND u.is_active = TRUE`,
    [email, tenantId]
  );
  return rows[0] || null;
};

const findTenantBySlug = async (slug) => {
  const rows = await query(`SELECT * FROM tenants WHERE slug = ?`, [slug]);
  return rows[0] || null;
};

const findUserById = async (id, tenantId) => {
  const rows = await query(
    `SELECT id, tenant_id, name, email, role, phone, is_active, last_login_at
     FROM users WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const updateLastLogin = async (userId) => {
  await query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [userId]);
};

const saveRefreshToken = async (userId, tenantId, token, expiresAt) => {
  await query(
    `INSERT INTO refresh_tokens (id, user_id, tenant_id, token, expires_at, created_at)
     VALUES (UUID(), ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)`,
    [userId, tenantId, token, expiresAt]
  );
};

const findRefreshToken = async (token) => {
  const rows = await query(
    `SELECT rt.*, u.role, u.is_active, u.tenant_id
     FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id
     WHERE rt.token = ? AND rt.expires_at > NOW()`,
    [token]
  );
  return rows[0] || null;
};

const deleteRefreshToken = async (token) => {
  await query(`DELETE FROM refresh_tokens WHERE token = ?`, [token]);
};

const createTenantWithAdmin = async ({ tenantId, tenantName, slug, plan, adminId, name, email, passwordHash, phone }) => {
  const trx = await beginTransaction();
  try {
    await trx.query(
      `INSERT INTO tenants (id, name, slug, plan, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'trial', NOW(), NOW())`,
      [tenantId, tenantName, slug, plan]
    );
    await trx.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role, phone, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'admin', ?, TRUE, NOW(), NOW())`,
      [adminId, tenantId, name, email, passwordHash, phone || null]
    );
    await trx.query(
      `INSERT INTO document_counters (id, tenant_id, doc_type, prefix, year, last_number)
       VALUES (UUID(), ?, 'INIT', 'INIT', YEAR(NOW()), 0)`,
      [tenantId]
    );
    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  } finally {
    trx.release();
  }
};

const updateUserPassword = async (userId, tenantId, passwordHash) => {
  await query(
    `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    [passwordHash, userId, tenantId]
  );
};

module.exports = {
  findUserByEmail, findTenantBySlug, findUserById, updateLastLogin,
  saveRefreshToken, findRefreshToken, deleteRefreshToken,
  createTenantWithAdmin, updateUserPassword,
};
