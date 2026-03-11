'use strict';

const db = require('../../config/db');

exports.getLowStockAlerts = async () => {

  const [rows] = await db.query(`

    SELECT 
      p.name AS product_name,
      p.code AS product_code,
      i.boxes AS current_stock_boxes,
      i.warehouse_id,
      p.reorder_level_boxes

    FROM inventory i
    JOIN products p 
      ON p.id = i.product_id

    WHERE
      i.boxes <= p.reorder_level_boxes

    ORDER BY i.boxes ASC

  `);

  return rows;
};