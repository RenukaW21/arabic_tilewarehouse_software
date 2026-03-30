'use strict';
const { query } = require('../config/db');

/**
 * Roles that are scoped to a single assigned warehouse.
 * For these roles we look up `users.warehouse_id` and attach it as
 * `req.warehouseScope` so controllers can inject it into list queries.
 *
 * Admins, sales, accountant, and viewer see all warehouses → scope is null.
 */
const WAREHOUSE_SCOPED_ROLES = ['warehouse_manager', 'supervisor', 'warehouse_staff'];

const attachWarehouseScope = async (req, _res, next) => {
  req.warehouseScope = null; // default: no restriction

  if (!req.user || !WAREHOUSE_SCOPED_ROLES.includes(req.user.role)) {
    return next();
  }

  try {
    const rows = await query(
      'SELECT warehouse_id FROM users WHERE id = ? AND tenant_id = ? LIMIT 1',
      [req.user.id, req.tenantId]
    );
    req.warehouseScope = rows[0]?.warehouse_id ?? null;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { attachWarehouseScope };
