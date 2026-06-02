'use strict';
const { query } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

const findAll = async (tenantId, { platform, status, page = 1, limit = 25, search } = {}) => {
  const conditions = ['tenant_id = ?'];
  const params = [tenantId];
  if (platform) { conditions.push('platform = ?');          params.push(platform); }
  if (status)   { conditions.push('status = ?');            params.push(status); }
  if (search)   { conditions.push('(platform_order_id LIKE ? OR customer_name LIKE ?)');
                  params.push(`%${search}%`, `%${search}%`); }

  const where = conditions.join(' AND ');
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));
  const lim    = Math.min(100, Math.max(1, parseInt(limit)));

  const [rows, countRows] = await Promise.all([
    query(
      `SELECT id, tenant_id, platform, platform_order_id, platform_order_date,
              customer_name, customer_email, status, total_amount, currency,
              tracking_number, shipped_at, wms_sales_order_id, created_at, updated_at
       FROM marketplace_orders
       WHERE ${where}
       ORDER BY platform_order_date DESC, created_at DESC
       LIMIT ${lim} OFFSET ${offset}`,
      params
    ),
    query(`SELECT COUNT(*) AS total FROM marketplace_orders WHERE ${where}`, params),
  ]);

  return { rows, total: countRows[0].total };
};

const findById = async (id, tenantId) => {
  const rows = await query(
    `SELECT * FROM marketplace_orders WHERE id = ? AND tenant_id = ?`,
    [id, tenantId]
  );
  return rows[0] || null;
};

const findByPlatformOrderId = async (tenantId, platform, platformOrderId) => {
  const rows = await query(
    `SELECT * FROM marketplace_orders WHERE tenant_id = ? AND platform = ? AND platform_order_id = ?`,
    [tenantId, platform, platformOrderId]
  );
  return rows[0] || null;
};

const getStats = async (tenantId) => {
  const rows = await query(
    `SELECT
       COUNT(*) AS total,
       SUM(status = 'pending')   AS pending,
       SUM(status = 'confirmed') AS confirmed,
       SUM(status = 'shipped')   AS shipped,
       SUM(status = 'delivered') AS delivered,
       SUM(status = 'cancelled') AS cancelled,
       SUM(status = 'returned')  AS returned,
       SUM(platform = 'amazon')   AS amazon_total,
       SUM(platform = 'flipkart') AS flipkart_total,
       SUM(platform = 'meesho')   AS meesho_total
     FROM marketplace_orders
     WHERE tenant_id = ?`,
    [tenantId]
  );
  return rows[0];
};

const create = async (tenantId, data) => {
  const id = uuidv4();
  await query(
    `INSERT INTO marketplace_orders
       (id, tenant_id, platform, platform_order_id, platform_order_date, customer_name,
        customer_email, shipping_address, status, total_amount, currency, items, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, tenantId, data.platform, data.platform_order_id,
      data.platform_order_date || null, data.customer_name || null,
      data.customer_email || null, data.shipping_address || null,
      data.status || 'pending', data.total_amount || null,
      data.currency || 'INR',
      data.items ? JSON.stringify(data.items) : null,
      data.raw_payload ? JSON.stringify(data.raw_payload) : null,
    ]
  );
  return findById(id, tenantId);
};

const updateStatus = async (id, tenantId, status, extra = {}) => {
  const fields = ['status = ?', 'updated_at = NOW()'];
  const values = [status];

  if (extra.tracking_number !== undefined) { fields.push('tracking_number = ?'); values.push(extra.tracking_number); }
  if (extra.shipped_at !== undefined)       { fields.push('shipped_at = ?');      values.push(extra.shipped_at); }
  if (extra.wms_sales_order_id !== undefined) { fields.push('wms_sales_order_id = ?'); values.push(extra.wms_sales_order_id); }

  values.push(id, tenantId);
  await query(
    `UPDATE marketplace_orders SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
    values
  );
};

module.exports = { findAll, findById, findByPlatformOrderId, getStats, create, updateStatus };
