'use strict';
const service = require('./service');
const { importFromCsv } = require('./csvImport');
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

const create = async (req, res, next) => {
  try {
    if (req.file) {
      req.body.imageUrl = `/uploads/${req.file.filename}`;
    }

    if (!req.body.mrp || Number(req.body.mrp) <= 0) {
       return res.status(400).json({ 
         success: false, 
         error: { 
           code: 'VALIDATION_ERROR', 
           message: 'MRP is required and must be greater than zero.' 
         } 
       });
    }

    const product = await service.create(req.tenantId, req.body);

    const meta = extractRequestMeta(req);
    await writeAuditLog({ tenantId: req.tenantId, userId: req.user.id, action: 'CREATE', tableName: 'products', recordId: product.id, newValues: req.body, ...meta });
    return created(res, product, 'Product created');
  } catch (e) {
    next(e);
  }
};

const getShades = async (req, res) => {
  const shades = await service.getShades(req.params.id, req.tenantId);
  return success(res, shades, 'Shades fetched');
};
const update = async (req, res, next) => {
  try {
    const id = req.params.id;
    const old = await service.getById(id, req.tenantId);

    // Set imageUrl: use new upload path, or preserve existing image
    if (req.file) {
      req.body.imageUrl = `/uploads/${req.file.filename}`;
    } else if (old?.image_url && req.body.imageUrl == null) {
      req.body.imageUrl = old.image_url;
    }

    const product = await service.update(id, req.tenantId, req.body);

    const meta = extractRequestMeta(req);
    await writeAuditLog({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'UPDATE',
      tableName: 'products',
      recordId: product.id,
      oldValues: old,
      newValues: req.body,
      ...meta,
    });
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

const importCsv = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No CSV file uploaded' } });
  }

  const csvText = req.file.buffer.toString('utf-8');
  const result = await importFromCsv(req.tenantId, csvText);

  return res.status(200).json({
    success: true,
    message: `Import complete: ${result.imported} imported, ${result.skipped} skipped`,
    data: result,
  });
};

module.exports = { getAll, getById, getShades, create, update, remove, importCsv };
