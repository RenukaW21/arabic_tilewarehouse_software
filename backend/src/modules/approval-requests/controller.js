'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');
const { createSchema, approveRejectSchema } = require('./validation');

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
    const { rows, total } = await service.getAll(
      req.tenantId, req.user.id, req.user.role, req.query
    );
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    return paginated(res, rows, { page, limit, total }, 'Approval requests fetched');
  } catch (err) { next(err); }
};

const stats = async (req, res, next) => {
  try {
    const data = await service.getStats(req.tenantId);
    return success(res, data, 'Approval stats fetched');
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const data = await service.getById(req.params.id, req.tenantId, req.user.id, req.user.role);
    return success(res, data, 'Approval request fetched');
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const data = await service.create(req.tenantId, req.user.id, req.body);
    return created(res, data, 'Approval request submitted');
  } catch (err) { next(err); }
};

const approve = async (req, res, next) => {
  try {
    const { review_notes } = req.body;
    const data = await service.approve(req.params.id, req.tenantId, req.user.id, review_notes);
    return success(res, data, 'Request approved');
  } catch (err) { next(err); }
};

const reject = async (req, res, next) => {
  try {
    const { review_notes } = req.body;
    const data = await service.reject(req.params.id, req.tenantId, req.user.id, review_notes);
    return success(res, data, 'Request rejected');
  } catch (err) { next(err); }
};

module.exports = { list, stats, getById, create, approve, reject, validate };
