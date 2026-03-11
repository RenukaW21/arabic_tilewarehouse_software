'use strict';

const db = require('../../config/db');

exports.getLowStockAlerts = async (tenantId) => {
  const [rows] = await db.query(`
    SELECT 
      p.name AS product_name,
      p.code AS product_code,
      IFNULL(SUM(i.total_boxes), 0) AS current_stock_boxes,
      i.warehouse_id,
      p.reorder_level_boxes
    FROM stock_summary i
    JOIN products p 
      ON p.id = i.product_id
    WHERE i.tenant_id = ?
    GROUP BY p.id, p.name, p.code, i.warehouse_id, p.reorder_level_boxes
    HAVING current_stock_boxes <= p.reorder_level_boxes
    ORDER BY current_stock_boxes ASC
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