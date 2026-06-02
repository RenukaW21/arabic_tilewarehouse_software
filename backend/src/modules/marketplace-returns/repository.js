'use strict';
const { query } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const findAll = async (tenantId, { platform, status, page = 1, limit = 25, search } = {}) => {
  const conditions = ['tenant_id = ?'];
  const params = [tenantId];
  if (platform) { conditions.push('platform = ?'); params.push(platform); }
  if (status)   { conditions.push('status = ?');   params.push(status); }
  if (search)   {
    conditions.push('(platform_return_id LIKE ? OR platform_order_id LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = conditions.join(' AND ');
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));
  const lim    = Math.min(100, Math.max(1, parseInt(limit)));

  const [rows, countRows] = await Promise.all([
    query(
      `SELECT id, tenant_id, platform, platform_return_id, marketplace_order_id,
              platform_order_id, return_reason, return_quantity, status,
              wms_return_id, restocked_at, created_at, updated_at
       FROM marketplace_returns
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT ${lim} OFFSET ${offset}`,
      params
    ),
    query(`SELECT COUNT(*) AS total FROM marketplace_returns WHERE ${where}`, params),
  ]);

  return { rows, total: countRows[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT * FROM marketplace_returns WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const findByPlatformReturnId = async (tenantId, platform, platformReturnId) => {
  const rows = await query(
    `SELECT * FROM marketplace_returns WHERE tenant_id = ? AND platform = ? AND platform_return_id = ?`,
    [tenantId, platform, platformReturnId]
  );
  return rows[0] || null;
};

const create = async (tenantId, data) => {
  const id = uuidv4();
  await query(
    `INSERT INTO marketplace_returns
       (id, tenant_id, platform, platform_return_id, marketplace_order_id, platform_order_id,
        return_reason, return_quantity, status, items, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, tenantId, data.platform, data.platform_return_id,
      data.marketplace_order_id || null, data.platform_order_id || null,
      data.return_reason || null, data.return_quantity || 0,
      data.status || 'initiated',
      data.items ? JSON.stringify(data.items) : null,
      data.raw_payload ? JSON.stringify(data.raw_payload) : null,
    ]
  );
  return findById(id, tenantId);
};

const updateStatus = async (id, tenantId, status, extra = {}) => {
  const fields = ['status = ?', 'updated_at = NOW()'];
  const values = [status];

  if (extra.wms_return_id !== undefined) { fields.push('wms_return_id = ?'); values.push(extra.wms_return_id); }
  if (extra.restocked_at !== undefined)  { fields.push('restocked_at = ?');  values.push(extra.restocked_at); }

  values.push(id, tenantId);
  await query(
    `UPDATE marketplace_returns SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
    values
  );
};

module.exports = { findAll, findById, findByPlatformReturnId, create, updateStatus };
