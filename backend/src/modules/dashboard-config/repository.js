'use strict';

const { query } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const findByUser = async (userId, tenantId) => {
  const rows = await query(
    `SELECT config FROM user_dashboard_config WHERE user_id = ? AND tenant_id = ?`,
    [userId, tenantId]
  );
  if (!rows[0]) return null;
  const raw = rows[0].config;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
};

const upsert = async (userId, tenantId, config) => {
  const existing = await query(
    `SELECT id FROM user_dashboard_config WHERE user_id = ? AND tenant_id = ?`,
    [userId, tenantId]
  );

  const configJson = JSON.stringify(config);

  if (existing.length > 0) {
    await query(
      `UPDATE user_dashboard_config SET config = ?, updated_at = NOW()
       WHERE user_id = ? AND tenant_id = ?`,
      [configJson, userId, tenantId]
    );
  } else {
    const id = uuidv4();
    await query(
      `INSERT INTO user_dashboard_config (id, user_id, tenant_id, config)
       VALUES (?, ?, ?, ?)`,
      [id, userId, tenantId, configJson]
    );
  }

  return findByUser(userId, tenantId);
};

const remove = async (userId, tenantId) => {
  await query(
    `DELETE FROM user_dashboard_config WHERE user_id = ? AND tenant_id = ?`,
    [userId, tenantId]
  );
};

module.exports = { findByUser, upsert, remove };
