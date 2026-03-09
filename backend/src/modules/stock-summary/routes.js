'use strict';
const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { query } = require('../../config/db');
const { success } = require('../../utils/response');

router.use(authenticate);

router.get('/', async (req, res) => {
  const conditions = ['ss.tenant_id = ?'];
  const params = [req.tenantId];
  if (req.query.warehouseId) { conditions.push('ss.warehouse_id = ?'); params.push(req.query.warehouseId); }
  if (req.query.productId)   { conditions.push('ss.product_id = ?');   params.push(req.query.productId); }
  if (req.query.lowStock === 'true') { conditions.push('ss.total_boxes <= p.reorder_level_boxes'); }

  const rows = await query(
    `SELECT ss.*, p.name AS product_name, p.code, p.size_label, p.reorder_level_boxes,
            w.name AS warehouse_name, r.name AS rack_name
     FROM stock_summary ss
     JOIN products p ON ss.product_id = p.id
     JOIN warehouses w ON ss.warehouse_id = w.id
     LEFT JOIN racks r ON ss.rack_id = r.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.name ASC`,
    params
  );
  return success(res, rows, 'Stock summary');
});

module.exports = router;
