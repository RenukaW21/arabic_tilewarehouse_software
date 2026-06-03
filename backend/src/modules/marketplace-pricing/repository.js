'use strict';
const { query } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const findAll = async (tenantId, { platform, product_id, page = 1, limit = 50 } = {}) => {
  const conditions = ['mp.tenant_id = ?'];
  const params = [tenantId];
  if (platform)   { conditions.push('mp.platform = ?');   params.push(platform); }
  if (product_id) { conditions.push('mp.product_id = ?'); params.push(product_id); }

  const where = conditions.join(' AND ');
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));
  const lim    = Math.min(100, Math.max(1, parseInt(limit)));

  const [rows, countRows] = await Promise.all([
    query(
      `SELECT mp.*, p.name AS product_name, p.code AS product_sku, u.name AS updated_by_name
       FROM marketplace_pricing mp
       LEFT JOIN products p ON mp.product_id = p.id
       LEFT JOIN users u ON mp.updated_by = u.id
       WHERE ${where}
       ORDER BY p.name ASC, mp.platform ASC
       LIMIT ${lim} OFFSET ${offset}`,
      params
    ),
    query(`SELECT COUNT(*) AS total FROM marketplace_pricing mp WHERE ${where}`, params),
  ]);

  return { rows, total: countRows[0].total };
};

const findByProductAndPlatform = async (tenantId, productId, platform) => {
  const rows = await query(
    `SELECT * FROM marketplace_pricing WHERE tenant_id = ? AND product_id = ? AND platform = ?`,
    [tenantId, productId, platform]
  );
  return rows[0] || null;
};

const upsert = async (tenantId, productId, platform, price, userId) => {
  const id = uuidv4();
  // Requires a unique constraint on (tenant_id, product_id, platform) to be race-safe.
  await query(
    `INSERT INTO marketplace_pricing (id, tenant_id, product_id, platform, price, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE price = VALUES(price), updated_by = VALUES(updated_by), updated_at = NOW()`,
    [id, tenantId, productId, platform, price, userId]
  );
  return findByProductAndPlatform(tenantId, productId, platform);
};

const remove = async (tenantId, productId, platform) => {
  await query(
    `DELETE FROM marketplace_pricing WHERE tenant_id = ? AND product_id = ? AND platform = ?`,
    [tenantId, productId, platform]
  );
};

module.exports = { findAll, findByProductAndPlatform, upsert, remove };
