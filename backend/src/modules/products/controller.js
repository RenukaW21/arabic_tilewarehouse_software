'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');
const { writeAuditLog, extractRequestMeta } = require('../../utils/auditLog');

const getAll = async (req, res) => {
  const { rows, total } = await service.getAll(req.tenantId, req.query);
  const { page = 1, limit = 25 } = req.query;
  return paginated(res, rows, { page, limit, total }, 'Products fetched');
};

const getById = async (req, res) => {
  const product = await service.getById(req.params.id, req.tenantId);
  return success(res, product, 'Product fetched');
};

const create = async (req, res) => {
    if (req.file) {
    req.body.imageUrl = `/uploads/${req.file.filename}`;
  }
  const product = await service.create(req.tenantId, req.body);
  const meta = extractRequestMeta(req);
  await writeAuditLog({ tenantId: req.tenantId, userId: req.user.id, action: 'CREATE', tableName: 'products', recordId: product.id, newValues: req.body, ...meta });
  return created(res, product, 'Product created');
};

const update = async (req, res, next) => {
  try {
    const id = req.params.id;
    const old = await service.getById(id, req.tenantId);
    if (req.file) {
      req.body.imageUrl = `/uploads/${req.file.filename}`;
    } else if (old && old.image_url) {
      req.body.imageUrl = old.image_url;
    }
    const product = await service.update(id, req.tenantId, req.body);
    const meta = extractRequestMeta(req);
    await writeAuditLog({ tenantId: req.tenantId, userId: req.user.id, action: 'UPDATE', tableName: 'products', recordId: product.id, oldValues: old, newValues: req.body, ...meta });
    return success(res, product, 'Product updated');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res) => {
  const old = await service.getById(req.params.id, req.tenantId);
  await service.remove(req.params.id, req.tenantId);
  const meta = extractRequestMeta(req);
  await writeAuditLog({ tenantId: req.tenantId, userId: req.user.id, action: 'DELETE', tableName: 'products', recordId: req.params.id, oldValues: old, ...meta });
  return success(res, {}, 'Product deactivated');
};

module.exports = { getAll, getById, create, update, remove };
