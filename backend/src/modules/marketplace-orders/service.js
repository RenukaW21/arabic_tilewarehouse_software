'use strict';
const repo = require('./repository');
const { AppError } = require('../../middlewares/error.middleware');
const { writeAuditLog } = require('../../utils/auditLog');

const VALID_PLATFORMS = ['amazon', 'flipkart', 'meesho'];
const VALID_STATUSES  = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'];

const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const getById = async (id, tenantId) => {
  const row = await repo.findById(id, tenantId);
  if (!row) throw new AppError('Marketplace order not found', 404, 'NOT_FOUND');
  if (row.items)       row.items       = safeParseJson(row.items);
  if (row.raw_payload) row.raw_payload = safeParseJson(row.raw_payload);
  return row;
};

const getStats = async (tenantId) => repo.getStats(tenantId);

const updateStatus = async (id, tenantId, userId, status, extra = {}) => {
  if (!VALID_STATUSES.includes(status)) {
    throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
  const row = await repo.findById(id, tenantId);
  if (!row) throw new AppError('Marketplace order not found', 404, 'NOT_FOUND');

  await repo.updateStatus(id, tenantId, status, extra);

  await writeAuditLog({
    tenantId,
    userId,
    action: 'UPDATE',
    tableName: 'marketplace_orders',
    recordId: id,
    newValues: { status, ...extra },
  });

  return repo.findById(id, tenantId);
};

function safeParseJson(val) {
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return val; }
}

module.exports = { getAll, getById, getStats, updateStatus };
