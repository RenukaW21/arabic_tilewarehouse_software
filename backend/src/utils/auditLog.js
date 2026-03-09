'use strict';
const { query } = require('../config/db');
const logger = require('./logger');

/**
 * Write an audit log entry.
 * Fire-and-forget — errors are logged but not thrown.
 *
 * @param {Object} opts
 * @param {string} opts.tenantId
 * @param {string|null} opts.userId
 * @param {string} opts.action   - CREATE | UPDATE | DELETE | LOGIN | APPROVE | REJECT
 * @param {string} opts.tableName
 * @param {string|null} opts.recordId
 * @param {Object|null} opts.oldValues
 * @param {Object|null} opts.newValues
 * @param {string|null} opts.ipAddress
 * @param {string|null} opts.userAgent
 */
const writeAuditLog = async ({
  tenantId,
  userId = null,
  action,
  tableName,
  recordId = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    await query(
      `INSERT INTO audit_logs
         (id, tenant_id, user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        tenantId,
        userId,
        action,
        tableName,
        recordId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
      ]
    );
  } catch (err) {
    logger.warn('Audit log write failed', { error: err.message, action, tableName });
  }
};

/**
 * Extract request metadata for audit logs
 */
const extractRequestMeta = (req) => ({
  ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
  userAgent: req.headers['user-agent'] || null,
});

module.exports = { writeAuditLog, extractRequestMeta };
