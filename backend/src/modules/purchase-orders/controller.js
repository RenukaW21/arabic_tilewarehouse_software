'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');
const { createPOSchema, updatePOSchema, createPOItemSchema, updatePOItemSchema, listQuerySchema } = require('./validation');
const { AppError } = require('../../middlewares/error.middleware');

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
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 25));
    return paginated(res, rows, { page, limit, total }, 'Purchase orders fetched');
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const po = await service.getById(req.params.id, req.tenantId);
    return success(res, po, 'Purchase order fetched');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const po = await service.create(req.tenantId, req.user.id, req.body);
    return created(res, po, 'Purchase order created');
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const po = await service.update(req.params.id, req.tenantId, req.body);
    return success(res, po, 'Purchase order updated');
  } catch (err) {
    next(err);
  }
};

const approve = async (req, res, next) => {
  try {
    const po = await service.approve(req.params.id, req.tenantId);
    return success(res, po, 'Purchase order approved');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const po = await service.remove(req.params.id, req.tenantId);
    return success(res, po, 'Purchase order cancelled');
  } catch (err) {
    next(err);
  }
};

const addItem = async (req, res, next) => {
  try {
    const po = await service.addItem(req.params.id, req.tenantId, req.body);
    return created(res, po, 'Item added');
  } catch (err) {
    next(err);
  }
};

const updateItem = async (req, res, next) => {
  try {
    const po = await service.updateItem(req.params.id, req.params.itemId, req.tenantId, req.body);
    return success(res, po, 'Item updated');
  } catch (err) {
    next(err);
  }
};

const deleteItem = async (req, res, next) => {
  try {
    const po = await service.deleteItem(req.params.id, req.params.itemId, req.tenantId);
    return success(res, po, 'Item removed');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  approve,
  remove,
  addItem,
  updateItem,
  deleteItem,
  validate,
};
