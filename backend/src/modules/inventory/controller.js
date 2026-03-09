'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');
const { openingStockSchema, adjustStockSchema, listQuerySchema } = require('./validation');

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message,
        details: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      },
    });
  }
  req.body = value;
  next();
};

const listStock = async (req, res, next) => {
  try {
    const { error } = listQuerySchema.validate(req.query);
    if (error) return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: error.details[0].message } });
    const { rows, total } = await service.getAll(req.tenantId, req.query);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    return paginated(res, rows, { page, limit, total }, 'Stock summary fetched');
  } catch (err) {
    next(err);
  }
};

const getStockById = async (req, res, next) => {
  try {
    const row = await service.getById(req.params.id, req.tenantId);
    return success(res, row, 'Stock record fetched');
  } catch (err) {
    next(err);
  }
};

const createOpeningStock = async (req, res, next) => {
  try {
    const data = await service.createOpeningStock(req.tenantId, req.user.id, req.body);
    return created(res, data, 'Opening stock created');
  } catch (err) {
    next(err);
  }
};

const adjustStock = async (req, res, next) => {
  try {
    const data = await service.adjustStock(req.params.id, req.tenantId, req.user.id, req.body);
    return success(res, data, 'Stock adjusted');
  } catch (err) {
    next(err);
  }
};

const deleteStock = async (req, res, next) => {
  try {
    await service.remove(req.params.id, req.tenantId);
    return success(res, null, 'Deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listStock,
  getStockById,
  createOpeningStock,
  adjustStock,
  deleteStock,
  validate,
};
