'use strict';

const WAREHOUSE_SCOPED_ROLES = [
  'warehouse_manager',
  'supervisor',
  'warehouse_staff',
  'sales',
  'accountant',
];

function isWarehouseScopedRole(role) {
  return WAREHOUSE_SCOPED_ROLES.includes(role);
}

/**
 * Forces list/query params to the user's assigned warehouse for scoped roles.
 * Sets both snake_case and camelCase keys used across modules.
 */
function applyWarehouseScope(req, query) {
  if (isWarehouseScopedRole(req.user?.role) && req.user?.warehouse_id) {
    query.warehouse_id = req.user.warehouse_id;
    query.warehouseId = req.user.warehouse_id;
  }
  return query;
}

/** For GET-by-id / mutation guards: { warehouseId } or {} */
function scopedWarehouseOpts(req) {
  if (isWarehouseScopedRole(req.user?.role) && req.user?.warehouse_id) {
    return { warehouseId: req.user.warehouse_id };
  }
  return {};
}

module.exports = {
  WAREHOUSE_SCOPED_ROLES,
  isWarehouseScopedRole,
  applyWarehouseScope,
  scopedWarehouseOpts,
};
