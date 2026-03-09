'use strict';
const Joi = require('joi');

const returnItemSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  shade_id: Joi.string().uuid().allow(null, '').optional(),
  batch_id: Joi.string().uuid().allow(null, '').optional(),
  sales_order_item_id: Joi.string().uuid().allow(null, '').optional(),
  returned_boxes: Joi.number().min(0.01).required(),
  returned_pieces: Joi.number().min(0).optional().default(0),
  unit_price: Joi.number().min(0).required(),
});

const createReturnSchema = Joi.object({
  customer_id: Joi.string().uuid().required(),
  warehouse_id: Joi.string().uuid().required(),
  sales_order_id: Joi.string().uuid().allow(null, '').optional(),
  invoice_id: Joi.string().uuid().allow(null, '').optional(),
  return_date: Joi.date().optional(),
  return_reason: Joi.string().max(255).required(),
  notes: Joi.string().allow('', null).optional(),
  items: Joi.array().items(returnItemSchema).min(1).required(),
}).required();

const updateReturnSchema = Joi.object({
  customer_id: Joi.string().uuid().optional(),
  warehouse_id: Joi.string().uuid().optional(),
  return_date: Joi.date().optional(),
  return_reason: Joi.string().max(255).optional(),
  notes: Joi.string().allow('', null).optional(),
  items: Joi.array().items(returnItemSchema).min(1).optional(),
}).min(1);

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
  search: Joi.string().allow('').optional(),
  status: Joi.string().valid('draft', 'received', 'inspected', 'completed', 'cancelled').optional(),
  customer_id: Joi.string().uuid().optional(),
  sortBy: Joi.string().valid('return_date', 'created_at', 'return_number', 'status').optional(),
  sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').optional(),
});

module.exports = {
  createReturnSchema,
  updateReturnSchema,
  listQuerySchema,
};
