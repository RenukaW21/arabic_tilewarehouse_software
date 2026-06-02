'use strict';
const repo = require('./repository');
const { AppError } = require('../../middlewares/error.middleware');
const { writeAuditLog } = require('../../utils/auditLog');

const VALID_PLATFORMS = ['amazon', 'flipkart', 'meesho'];

const getAll = async (tenantId, queryParams) => repo.findAll(tenantId, queryParams);

const upsert = async (tenantId, userId, productId, platform, price) => {
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new AppError(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
  if (!price || isNaN(price) || Number(price) < 0) {
    throw new AppError('Price must be a non-negative number', 400, 'VALIDATION_ERROR');
  }

  const row = await repo.upsert(tenantId, productId, platform, Number(price), userId);

  await writeAuditLog({
    tenantId,
    userId,
    action: 'UPSERT',
    tableName: 'marketplace_pricing',
    recordId: row.id,
    newValues: { product_id: productId, platform, price },
  });

  return row;
};

const remove = async (tenantId, userId, productId, platform) => {
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new AppError(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
  const existing = await repo.findByProductAndPlatform(tenantId, productId, platform);
  if (!existing) throw new AppError('Pricing record not found', 404, 'NOT_FOUND');

  await repo.remove(tenantId, productId, platform);

  await writeAuditLog({
    tenantId,
    userId,
    action: 'DELETE',
    tableName: 'marketplace_pricing',
    recordId: existing.id,
    newValues: { product_id: productId, platform },
  });
};

module.exports = { getAll, upsert, remove };
