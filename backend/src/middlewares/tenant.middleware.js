'use strict';
const env = require('../config/env');
const { error } = require('../utils/response');

/**
 * Tenant resolution middleware.
 * Supports: 'jwt' (default) | 'header' | 'subdomain'
 *
 * After authenticate middleware runs, tenantId is already set from JWT.
 * This middleware validates and can override for header/subdomain strategies.
 */
const resolveTenant = (req, res, next) => {
  const strategy = env.tenant.resolution;

  if (strategy === 'jwt') {
    // tenantId already set by auth.middleware from JWT payload
    if (!req.tenantId && req.user?.tenantId) {
      req.tenantId = req.user.tenantId;
    }
    return next();
  }

  if (strategy === 'header') {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return error(res, 'Tenant ID header (x-tenant-id) is required', 400, 'TENANT_MISSING');
    }
    req.tenantId = tenantId;
    return next();
  }

  if (strategy === 'subdomain') {
    const host = req.hostname; // e.g. "acme.api.example.com"
    const parts = host.split('.');
    if (parts.length < 3) {
      return error(res, 'Invalid subdomain for tenant resolution', 400, 'TENANT_MISSING');
    }
    req.tenantSlug = parts[0]; // Resolve to tenantId via DB lookup in auth flow
    return next();
  }

  next();
};

/**
 * Guard: ensure tenantId is present before reaching controllers.
 * Must be placed after authenticate + resolveTenant.
 */
const ensureTenant = (req, res, next) => {
  if (!req.tenantId) {
    return error(res, 'Tenant context is missing', 400, 'TENANT_MISSING');
  }
  next();
};

module.exports = { resolveTenant, ensureTenant };
