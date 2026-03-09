'use strict';
const Joi = require('joi');

const createSchema = Joi.object({
  warehouse_id: Joi.string().uuid().required(),
  product_id: Joi.string().uuid().required(),
  shade_id: Joi.string().uuid().allow(null).optional(),
  batch_id: Joi.string().uuid().allow(null).optional(),
  rack_id: Joi.string().uuid().allow(null).optional(),
  damage_date: Joi.date().optional(),
  damaged_boxes: Joi.number().min(0).required(),
  damaged_pieces: Joi.number().min(0).optional().default(0),
  damage_reason: Joi.string().max(255).allow('', null).optional(),
  estimated_loss: Joi.number().min(0).allow(null).optional(),
  notes: Joi.string().allow('', null).optional(),
}).required();

const updateSchema = Joi.object({
  warehouse_id: Joi.string().uuid().optional(),
  product_id: Joi.string().uuid().optional(),
  shade_id: Joi.string().uuid().allow(null).optional(),
  batch_id: Joi.string().uuid().allow(null).optional(),
  rack_id: Joi.string().uuid().allow(null).optional(),
  damage_date: Joi.date().optional(),
  damaged_boxes: Joi.number().min(0).optional(),
  damaged_pieces: Joi.number().min(0).optional(),
  damage_reason: Joi.string().max(255).allow('', null).optional(),
  estimated_loss: Joi.number().min(0).allow(null).optional(),
  notes: Joi.string().allow('', null).optional(),
}).min(1);

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
  search: Joi.string().allow('').optional(),
  sortBy: Joi.string().valid('damage_date', 'created_at', 'damaged_boxes').optional(),
  sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').optional(),
});

module.exports = { createSchema, updateSchema, listQuerySchema };
