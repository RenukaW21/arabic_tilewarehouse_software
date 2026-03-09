'use strict';
const { PERMISSIONS } = require('../constants/roles');
const { error } = require('../utils/response');

/**
 * Permission-based route protection using PERMISSIONS matrix.
 * Use when you want to protect by exact METHOD + path pattern.
 *
 * @param {string} permissionKey - Key from PERMISSIONS, e.g. 'POST /grn', 'GET /warehouses'
 * @returns {Function} Express middleware
 */
const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    const allowedRoles = PERMISSIONS[permissionKey];
    if (!allowedRoles) {
      // No permission defined for this key — allow (or deny) per your policy
      return next();
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return error(
      res,
      `Access denied. This action requires one of: ${allowedRoles.join(', ')}`,
      403,
      'FORBIDDEN'
    );
  };
};

/**
 * Build permission key from request (for dynamic use).
 * Path is normalized to base path (first segment) for list endpoints.
 * e.g. GET /api/v1/grn/123 → GET /grn (if you strip prefix and use first segment)
 */
const getPermissionKey = (method, path) => {
  const segments = path.replace(/^\/+/, '').split('/');
  const basePath = '/' + (segments[0] || '');
  return `${method} ${basePath}`;
};

module.exports = { requirePermission, getPermissionKey };
