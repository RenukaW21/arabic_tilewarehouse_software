'use strict';
const repo = require('./repository');
const { AppError } = require('../../middlewares/error.middleware');
const { writeAuditLog } = require('../../utils/auditLog');

const VALID_PLATFORMS = ['amazon', 'flipkart', 'meesho'];

const getAll = async (tenantId) => repo.findAll(tenantId);

const getByPlatform = async (tenantId, platform) => {
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new AppError(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
  const row = await repo.findByPlatform(tenantId, platform);
  if (!row) throw new AppError('Credentials not configured for this platform', 404, 'NOT_FOUND');
  // Mask secrets before returning
  return maskSecrets(row);
};

const save = async (tenantId, userId, platform, data) => {
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new AppError(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
  const row = await repo.upsert(tenantId, platform, data);

  await writeAuditLog({
    tenantId,
    userId,
    action: 'UPSERT',
    tableName: 'marketplace_credentials',
    recordId: row.id,
    newValues: { platform, display_name: data.display_name },
  });

  return maskSecrets(row);
};

const remove = async (tenantId, userId, id) => {
  const row = await repo.findById(id, tenantId);
  if (!row) throw new AppError('Credentials not found', 404, 'NOT_FOUND');

  await repo.remove(id, tenantId);

  await writeAuditLog({
    tenantId,
    userId,
    action: 'DELETE',
    tableName: 'marketplace_credentials',
    recordId: id,
    newValues: { platform: row.platform },
  });
};

// Never return raw secrets to the frontend
function maskSecrets(row) {
  if (!row) return null;
  return {
    ...row,
    api_key:       row.api_key       ? '••••••••' : null,
    api_secret:    row.api_secret    ? '••••••••' : null,
    access_token:  row.access_token  ? '••••••••' : null,
    refresh_token: row.refresh_token ? '••••••••' : null,
  };
}

module.exports = { getAll, getByPlatform, save, remove };
