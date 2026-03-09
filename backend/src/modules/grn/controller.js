'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');
const { writeAuditLog, extractRequestMeta } = require('../../utils/auditLog');

const getAll = async (req, res) => {
  const { rows, total } = await service.getAll(req.tenantId, req.query);
  return paginated(res, rows, { page: req.query.page || 1, limit: req.query.limit || 25, total });
};

const getById = async (req, res) => {
  const grn = await service.getById(req.params.id, req.tenantId);
  return success(res, grn, 'GRN fetched');
};

const create = async (req, res) => {
  const grn = await service.create(req.tenantId, req.user.id, req.body);
  const meta = extractRequestMeta(req);
  await writeAuditLog({ tenantId: req.tenantId, userId: req.user.id, action: 'CREATE', tableName: 'grn', recordId: grn.id, newValues: req.body, ...meta });
  return created(res, grn, 'GRN created');
};

const postGRN = async (req, res) => {
  const grn = await service.postGRN(req.params.id, req.tenantId, req.user.id);
  const meta = extractRequestMeta(req);
  await writeAuditLog({ tenantId: req.tenantId, userId: req.user.id, action: 'POST_GRN', tableName: 'grn', recordId: req.params.id, newValues: { status: 'posted' }, ...meta });
  return success(res, grn, 'GRN posted — stock updated');
};

const updateQuality = async (req, res) => {
  await service.updateQuality(req.params.id, req.tenantId, req.params.itemId, req.body);
  return success(res, {}, 'Quality status updated');
};

module.exports = { getAll, getById, create, postGRN, updateQuality };
