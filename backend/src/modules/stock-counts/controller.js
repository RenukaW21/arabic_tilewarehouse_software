'use strict';
const service = require('./service');
const { success, created, paginated } = require('../../utils/response');
const Joi = require('joi');

const createSchema = Joi.object({
  warehouse_id: Joi.string().uuid().required(),
  count_type: Joi.string().valid('full', 'cycle', 'spot').optional(),
  count_date: Joi.date().optional(),
}).required();

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().allow('').optional(),
  sortBy: Joi.string().valid('count_date', 'created_at', 'count_number').optional(),
  sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').optional(),
});

const list = async (req, res, next) => {
  try {
    const { error } = listQuerySchema.validate(req.query);
    if (error) return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: error.details[0].message } });
    const { rows, total } = await service.getAll(req.tenantId, req.query);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    return paginated(res, rows, { page, limit, total }, 'Stock counts fetched');
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const data = await service.getById(req.params.id, req.tenantId);
    return success(res, data, 'Stock count fetched');
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message } });
    const data = await service.create(req.tenantId, req.user.id, value);
    return created(res, data, 'Stock count created');
  } catch (err) {
    next(err);
  }
};

const loadFromStock = async (req, res, next) => {
  try {
    const data = await service.loadFromStock(req.params.id, req.tenantId);
    return success(res, data, 'Items loaded from stock');
  } catch (err) {
    next(err);
  }
};

const updateItem = async (req, res, next) => {
  try {
    const data = await service.updateItem(req.params.id, req.params.itemId, req.tenantId, req.body.counted_boxes);
    return success(res, data, 'Item updated');
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, loadFromStock, updateItem };
