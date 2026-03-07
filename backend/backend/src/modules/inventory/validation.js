'use strict';
const Joi = require('joi');

const openingStockSchema = Joi.object({
  warehouse_id: Joi.string().uuid().required(),
  product_id: Joi.string().uuid().required(),
  rack_id: Joi.string().uuid().allow(null).optional(),
  shade_id: Joi.string().uuid().allow(null).optional(),
  batch_id: Joi.string().uuid().allow(null).optional(),
  boxes: Joi.number().min(0).required(),
  pieces: Joi.number().min(0).optional().default(0),
  sqft_per_box: Joi.number().min(0).optional(),
  unit_price: Joi.number().min(0).allow(null).optional(),
  notes: Joi.string().allow('', null).optional(),
}).required();

const adjustStockSchema = Joi.object({
  boxes_in: Joi.number().min(0).optional(),
  boxes_out: Joi.number().min(0).optional(),
  pieces_in: Joi.number().min(0).optional(),
  pieces_out: Joi.number().min(0).optional(),
  notes: Joi.string().allow('', null).optional(),
}).min(1);

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
  search: Joi.string().max(100).allow('').optional(),
  sortBy: Joi.string().valid('code', 'product_name', 'warehouse_name', 'total_boxes', 'total_pieces', 'total_sqft', 'updated_at').optional(),
  sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').optional(),
});

module.exports = {
  openingStockSchema,
  adjustStockSchema,
  listQuerySchema,
};
