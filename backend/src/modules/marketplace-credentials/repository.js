'use strict';
const { query } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const findAll = async (tenantId) => {
  return query(
    `SELECT id, tenant_id, platform, display_name, seller_id, marketplace_id,
            fulfillment_type, is_active, last_sync_at, created_at, updated_at
     FROM marketplace_credentials
     WHERE tenant_id = ?
     ORDER BY platform ASC`,
    [tenantId]
  );
};

const findByPlatform = async (tenantId, platform) => {
  const rows = await query(
    `SELECT * FROM marketplace_credentials WHERE tenant_id = ? AND platform = ?`,
    [tenantId, platform]
  );
  return rows[0] || null;
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT id, tenant_id, platform, display_name, seller_id, marketplace_id,
            fulfillment_type, is_active, last_sync_at, created_at, updated_at
     FROM marketplace_credentials WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const upsert = async (tenantId, platform, data) => {
  const existing = await findByPlatform(tenantId, platform);
  if (existing) {
    const fields = [];
    const values = [];
    const allowed = ['display_name','seller_id','api_key','api_secret','access_token','refresh_token',
                     'token_expires_at','marketplace_id','fulfillment_type','is_active'];
    allowed.forEach(f => {
      if (data[f] !== undefined) { fields.push(`${f} = ?`); values.push(data[f]); }
    });
    if (!fields.length) return existing;
    values.push(existing.id, tenantId);
    await query(
      `UPDATE marketplace_credentials SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values
    );
    return findById(existing.id, tenantId);
  }
  const id = uuidv4();
  await query(
    `INSERT INTO marketplace_credentials
       (id, tenant_id, platform, display_name, seller_id, api_key, api_secret,
        access_token, refresh_token, token_expires_at, marketplace_id, fulfillment_type, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, tenantId, platform,
      data.display_name || null, data.seller_id || null,
      data.api_key || null, data.api_secret || null,
      data.access_token || null, data.refresh_token || null,
      data.token_expires_at || null, data.marketplace_id || null,
      data.fulfillment_type || null, data.is_active !== undefined ? data.is_active : 1,
    ]
  );
  return findById(id, tenantId);
};

const updateLastSync = async (tenantId, platform) => {
  await query(
    `UPDATE marketplace_credentials SET last_sync_at = NOW(), updated_at = NOW()
     WHERE tenant_id = ? AND platform = ?`,
    [tenantId, platform]
  );
};

const remove = async (id, tenantId) => {
  await query(
    `DELETE FROM marketplace_credentials WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
};

module.exports = { findAll, findByPlatform, findById, upsert, updateLastSync, remove };
