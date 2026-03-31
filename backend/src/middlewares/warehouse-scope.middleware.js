'use strict';
const { query } = require('../config/db');
const { isWarehouseScopedRole } = require('../utils/warehouseScope');

/**
 * Roles that are scoped to a single assigned warehouse.
 * For these roles we look up `users.warehouse_id` and attach it as
 * `req.warehouseScope` so controllers can inject it into list queries.
 *
 * Only admin and viewer see all warehouses → scope is null.
 */

const attachWarehouseScope = async (req, _res, next) => {
  req.warehouseScope = null; // default: no restriction

  if (!req.user || !isWarehouseScopedRole(req.user.role)) {
    return next();
  }

  try {
    const rows = await query(
      'SELECT warehouse_id FROM users WHERE id = ? AND tenant_id = ? LIMIT 1',
      [req.user.id, req.tenantId]
    );
    const wid = rows[0]?.warehouse_id ?? null;
    req.warehouseScope = wid;
    // Controllers use req.user.warehouse_id for scoped roles
    req.user.warehouse_id = wid;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { attachWarehouseScope };
