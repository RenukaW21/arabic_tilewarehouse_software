'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');
const { createReturnSchema, updateReturnSchema, listQuerySchema } = require('./validation');

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

const getAll = async (req, res, next) => {
  try {
    const { error } = listQuerySchema.validate(req.query);
    if (error) return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: error.details[0].message } });
    const { rows, total } = await service.getAll(req.tenantId, req.query);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    return paginated(res, rows, { page, limit, total }, 'Purchase returns fetched');
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const data = await service.getById(req.params.id, req.tenantId);
    return success(res, data, 'Purchase return fetched');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const data = await service.create(req.tenantId, req.user.id, req.body);
    return created(res, data, 'Purchase return created');
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const data = await service.update(req.params.id, req.tenantId, req.body);
    return success(res, data, 'Purchase return updated');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  validate,
};
