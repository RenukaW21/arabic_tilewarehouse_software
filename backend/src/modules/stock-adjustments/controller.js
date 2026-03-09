'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');
const { createSchema, updateSchema, listQuerySchema } = require('./validation');

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

const list = async (req, res, next) => {
  try {
    const { error } = listQuerySchema.validate(req.query);
    if (error) return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: error.details[0].message } });
    const { rows, total } = await service.getAll(req.tenantId, req.query);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    return paginated(res, rows, { page, limit, total }, 'Stock adjustments fetched');
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const data = await service.getById(req.params.id, req.tenantId);
    return success(res, data, 'Stock adjustment fetched');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const data = await service.create(req.tenantId, req.user.id, req.body);
    return created(res, data, 'Stock adjustment created');
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const data = await service.update(req.params.id, req.tenantId, req.body);
    return success(res, data, 'Stock adjustment updated');
  } catch (err) {
    next(err);
  }
};

const approve = async (req, res, next) => {
  try {
    const data = await service.approve(req.params.id, req.tenantId, req.user.id);
    return success(res, data, 'Stock adjustment approved');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id, req.tenantId);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, approve, remove, validate };
