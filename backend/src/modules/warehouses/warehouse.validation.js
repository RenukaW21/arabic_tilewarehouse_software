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

const updateWarehouseSchema = Joi.object({
  name: Joi.string().min(2).max(255).allow(null, '').optional(),
  code: Joi.string().max(50).allow(null, '').optional(),
  address: Joi.string().allow(null, '').optional(),
  city: Joi.string().max(100).allow(null, '').optional(),
  state: Joi.string().max(100).allow(null, '').optional(),
  pincode: Joi.string().max(20).allow(null, '').optional(),
  is_active: Joi.boolean().truthy(1, '1', 'true').falsy(0, '0', 'false').optional(),
}).min(1).unknown(true);

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
