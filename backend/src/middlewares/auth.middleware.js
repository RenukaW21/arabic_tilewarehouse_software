'use strict';
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { error } = require('../utils/response');

/**
 * Verify JWT access token and inject req.user + req.tenantId
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'No token provided', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwt.secret);

    req.user = {
      id: decoded.sub,
      tenantId: decoded.tenantId,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
    };

    // tenantId is always derived from the JWT — ensures tenant isolation
    req.tenantId = decoded.tenantId;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired', 401, 'TOKEN_EXPIRED');
    }
    if (err.name === 'JsonWebTokenError') {
      return error(res, 'Invalid token', 401, 'INVALID_TOKEN');
    }
    return error(res, 'Authentication failed', 401, 'UNAUTHORIZED');
  }
};

/**
 * Optional auth — attaches user if token present, continues if not.
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.jwt.secret);
      req.user = decoded;
      req.tenantId = decoded.tenantId;
    }
  } catch (_) {
    // ignore — user simply remains undefined
  }
  next();
};

module.exports = { authenticate, optionalAuth };
