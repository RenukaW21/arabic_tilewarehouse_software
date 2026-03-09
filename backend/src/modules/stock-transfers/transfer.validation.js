'use strict';

const Joi = require('joi');

const statusEnum = ['draft', 'in_transit', 'received', 'cancelled'];

const transferItemSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  shade_id: Joi.string().uuid().allow(null),
  batch_id: Joi.string().uuid().allow(null),
  from_rack_id: Joi.string().uuid().allow(null),
  to_rack_id: Joi.string().uuid().allow(null),
  transferred_boxes: Joi.number().min(0).required(),
  transferred_pieces: Joi.number().min(0).optional(),
});

const createTransferSchema = Joi.object({
  transfer_number: Joi.string().max(50).required(),
  from_warehouse_id: Joi.string().uuid().required(),
  to_warehouse_id: Joi.string().uuid().required(),
  status: Joi.string().valid(...statusEnum).default('draft'),
  transfer_date: Joi.date().iso().required(),
  received_date: Joi.date().iso().allow(null),
  vehicle_number: Joi.string().max(50).allow(null, ''),
  notes: Joi.string().allow(null, ''),
  items: Joi.array().items(transferItemSchema).min(0).optional(),
});

const updateTransferSchema = Joi.object({
  transfer_number: Joi.string().max(50),
  from_warehouse_id: Joi.string().uuid(),
  to_warehouse_id: Joi.string().uuid(),
  status: Joi.string().valid(...statusEnum),
  transfer_date: Joi.date().iso(),
  received_date: Joi.date().iso().allow(null),
  vehicle_number: Joi.string().max(50).allow(null, ''),
  notes: Joi.string().allow(null, ''),
  items: Joi.array().items(transferItemSchema).min(0).optional(),
}).min(1);

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().max(100).allow('').optional(),
  sortBy: Joi.string().valid('transfer_number', 'transfer_date', 'created_at').optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
});

module.exports = {
  createTransferSchema,
  updateTransferSchema,
  listQuerySchema,
};
