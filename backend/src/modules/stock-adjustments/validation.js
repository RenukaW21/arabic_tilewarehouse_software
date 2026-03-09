'use strict';
const Joi = require('joi');

const createSchema = Joi.object({
  warehouse_id: Joi.string().uuid().required(),
  product_id: Joi.string().uuid().required(),
  shade_id: Joi.string().uuid().allow(null).optional(),
  batch_id: Joi.string().uuid().allow(null).optional(),
  rack_id: Joi.string().uuid().allow(null).optional(),
  adjustment_type: Joi.string().valid('add', 'deduct').required(),
  boxes: Joi.number().min(0).required(),
  pieces: Joi.number().min(0).optional().default(0),
  reason: Joi.string().max(255).required(),
}).required();

const updateSchema = Joi.object({
  warehouse_id: Joi.string().uuid().optional(),
  product_id: Joi.string().uuid().optional(),
  adjustment_type: Joi.string().valid('add', 'deduct').optional(),
  boxes: Joi.number().min(0).optional(),
  pieces: Joi.number().min(0).optional(),
  reason: Joi.string().max(255).optional(),
  status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
}).min(1);

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
  search: Joi.string().allow('').optional(),
  sortBy: Joi.string().valid('created_at', 'reason', 'status').optional(),
  sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').optional(),
  status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
});

module.exports = { createSchema, updateSchema, listQuerySchema };
