'use strict';
const { ROLE_HIERARCHY } = require('../constants/roles');
const { error } = require('../utils/response');

/**
 * Require one of the specified roles.
 * Usage: router.post('/', authenticate, requireRole(['admin', 'warehouse_manager']), controller)
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const userRole = req.user.role;

    // super_admin always passes
    if (userRole === 'super_admin') return next();

    if (!allowedRoles.includes(userRole)) {
      return error(
        res,
        `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        403,
        'FORBIDDEN'
      );
    }
    next();
  };
};

/**
 * Require minimum role level (hierarchy-based).
 * Usage: requireMinRole('warehouse_manager') — allows warehouse_manager, admin, super_admin
 */
const requireMinRole = (minRole) => {
  const minIndex = ROLE_HIERARCHY.indexOf(minRole);

  return (req, res, next) => {
    if (!req.user) return error(res, 'Not authenticated', 401, 'UNAUTHORIZED');

    const userIndex = ROLE_HIERARCHY.indexOf(req.user.role);
    if (userIndex < minIndex) {
      return error(res, 'Insufficient permissions', 403, 'FORBIDDEN');
    }
    next();
  };
};

/**
 * Allow user to access only their own resource OR if admin+
 */
const requireSelfOrAdmin = (req, res, next) => {
  if (!req.user) return error(res, 'Not authenticated', 401, 'UNAUTHORIZED');

  const userIndex = ROLE_HIERARCHY.indexOf(req.user.role);
  const adminIndex = ROLE_HIERARCHY.indexOf('admin');
  const isAdmin = userIndex >= adminIndex;
  const isSelf = req.params.id === req.user.id;

  if (!isAdmin && !isSelf) {
    return error(res, 'Access denied', 403, 'FORBIDDEN');
  }
  next();
};

module.exports = { requireRole, requireMinRole, requireSelfOrAdmin };
