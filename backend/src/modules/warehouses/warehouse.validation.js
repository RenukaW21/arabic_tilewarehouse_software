'use strict';

const Joi = require('joi');

const createWarehouseSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  code: Joi.string().max(50).required(),
  address: Joi.string().allow(null, ''),
  city: Joi.string().max(100).allow(null, ''),
  state: Joi.string().max(100).allow(null, ''),
  pincode: Joi.string().max(20).allow(null, ''),
  is_active: Joi.boolean().default(true),
});

const updateWarehouseSchema = createWarehouseSchema.min(1);

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().max(100).allow('').optional(),
  sortBy: Joi.string().valid('name', 'code', 'created_at').optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
  is_active: Joi.any().optional(),
});

module.exports = {
  createWarehouseSchema,
  updateWarehouseSchema,
  listQuerySchema,
};
