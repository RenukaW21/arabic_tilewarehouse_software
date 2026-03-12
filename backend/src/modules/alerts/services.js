'use strict';

const db = require('../../config/db');

exports.getLowStockAlerts = async (tenantId) => {
  const [rows] = await db.query(`
    SELECT 
      a.id,
      p.name AS product_name,
      p.code AS product_code,
      a.current_stock_boxes,
      a.reorder_level_boxes,
      w.name AS warehouse_name,
      a.status,
      a.alerted_at
    FROM low_stock_alerts a
    JOIN products p ON p.id = a.product_id
    LEFT JOIN warehouses w ON w.id = a.warehouse_id
    WHERE a.tenant_id = ? AND a.status != 'resolved'
    ORDER BY a.alerted_at DESC
  `, [tenantId]);

  return rows;
};

// Placeholder for updateAlertStatus if called in controllers
exports.updateAlertStatus = async (id, status, tenantId) => {
  const [result] = await db.query(
    'UPDATE low_stock_alerts SET status = ? WHERE id = ? AND tenant_id = ?',
    [status, id, tenantId]
  );
  return result;
};