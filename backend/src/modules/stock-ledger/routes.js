'use strict';
const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { query } = require('../../config/db');
const { paginated } = require('../../utils/response');
const { parsePagination } = require('../../utils/pagination');

router.use(authenticate);

router.get('/', async (req, res) => {
  const { page, limit, offset, sortBy, sortOrder } = parsePagination(req.query, ['transaction_date','created_at']);
  const conditions = ['sl.tenant_id = ?'];
  const params = [req.tenantId];
  if (req.query.productId)   { conditions.push('sl.product_id = ?');   params.push(req.query.productId); }
  if (req.query.warehouseId) { conditions.push('sl.warehouse_id = ?'); params.push(req.query.warehouseId); }
  if (req.query.type) {
    const typeMap = { GRN: 'grn', SALES_DISPATCH: 'sale', ADJUSTMENT_IN: 'adjustment', ADJUSTMENT_OUT: 'adjustment', TRANSFER_IN: 'transfer_in', TRANSFER_OUT: 'transfer_out', RETURN_IN: 'return', DAMAGE: 'damage', OPENING: 'opening' };
    const dbType = typeMap[String(req.query.type).toUpperCase()] || String(req.query.type).toLowerCase();
    conditions.push('sl.transaction_type = ?'); params.push(dbType);
  }
  if (req.query.from)        { conditions.push('sl.transaction_date >= ?'); params.push(req.query.from); }
  if (req.query.to)          { conditions.push('sl.transaction_date <= ?'); params.push(req.query.to); }
  const where = conditions.join(' AND ');
  const [rows, count] = await Promise.all([
    query(`SELECT sl.id, sl.tenant_id, sl.warehouse_id, sl.rack_id, sl.product_id, sl.shade_id, sl.batch_id,
           sl.transaction_type, sl.reference_id, sl.reference_type, sl.reference_id AS reference_number,
           sl.boxes_in AS qty_boxes_in, sl.boxes_out AS qty_boxes_out,
           sl.pieces_in, sl.pieces_out, sl.balance_boxes, sl.balance_pieces,
           sl.sqft_in, sl.sqft_out, sl.transaction_date, sl.created_by, sl.created_at, sl.notes,
           p.name AS product_name, p.code AS product_code, w.name AS warehouse_name
           FROM stock_ledger sl JOIN products p ON sl.product_id = p.id JOIN warehouses w ON sl.warehouse_id = w.id
           WHERE ${where} ORDER BY sl.${sortBy} ${sortOrder} LIMIT ${limit} OFFSET ${offset}`,
      params),
    query(`SELECT COUNT(*) AS total FROM stock_ledger sl WHERE ${where}`, params),
  ]);
  const total = Number(count[0]?.total ?? 0);
  return paginated(res, rows, { page, limit, total }, 'Stock ledger');
});

module.exports = router;
