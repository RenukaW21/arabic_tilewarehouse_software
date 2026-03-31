'use strict';
const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { attachWarehouseScope } = require('../../middlewares/warehouse-scope.middleware');
const { query } = require('../../config/db');
const { success } = require('../../utils/response');
const { applyWarehouseScope } = require('../../utils/warehouseScope');

router.use(authenticate);
router.use(attachWarehouseScope);

router.get('/', async (req, res) => {
  const q = { ...req.query };
  applyWarehouseScope(req, q);
  const conditions = ['ss.tenant_id = ?'];
  const params = [req.tenantId];
  if (q.warehouseId) { conditions.push('ss.warehouse_id = ?'); params.push(q.warehouseId); }
  if (q.productId)   { conditions.push('ss.product_id = ?');   params.push(q.productId); }
  if (q.lowStock === 'true') { conditions.push('ss.total_boxes <= p.reorder_level_boxes'); }

  const rows = await query(
    `SELECT ss.*,
            p.name AS product_name, p.code, p.size_label, p.reorder_level_boxes,
            w.name AS warehouse_name,
            r.name AS rack_name,
            COALESCE(res.reserved_boxes, 0) AS reserved_boxes,
            GREATEST(0, ss.total_boxes - COALESCE(res.reserved_boxes, 0)) AS available_boxes
     FROM stock_summary ss
     JOIN products p ON ss.product_id = p.id
     JOIN warehouses w ON ss.warehouse_id = w.id
     LEFT JOIN racks r ON ss.rack_id = r.id
     LEFT JOIN (
       SELECT tenant_id, warehouse_id, product_id, shade_id, batch_id,
              SUM(boxes_reserved) AS reserved_boxes
       FROM stock_reservations
       GROUP BY tenant_id, warehouse_id, product_id, shade_id, batch_id
     ) res ON res.tenant_id = ss.tenant_id
           AND res.warehouse_id = ss.warehouse_id
           AND res.product_id = ss.product_id
           AND (res.shade_id <=> ss.shade_id)
           AND (res.batch_id <=> ss.batch_id)
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.name ASC`,
    params
  );
  return success(res, rows, 'Stock summary');
});

module.exports = router;
