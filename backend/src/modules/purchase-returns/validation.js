'use strict';
const Joi = require('joi');

const createReturnSchema = Joi.object({
  purchase_order_id: Joi.string().uuid().allow(null).optional(),
  grn_id:            Joi.string().uuid().allow(null).optional(),
  vendor_id:         Joi.string().uuid().required(),
  warehouse_id:      Joi.string().uuid().required(),
  return_date:       Joi.date().required(),
  reason:            Joi.string().max(255).required(),
  notes:             Joi.string().allow('', null).optional(),
  vehicle_number:    Joi.string().max(50).allow('', null).optional(),
  items: Joi.array()
    .min(1)
    .items(
      Joi.object({
        grn_item_id:     Joi.string().uuid().allow(null).optional(),
        product_id:      Joi.string().uuid().required(),
        shade_id:        Joi.string().uuid().allow(null).optional(),
        batch_id:        Joi.string().uuid().allow(null).optional(),
        returned_boxes:  Joi.number().min(0).required(),
        returned_pieces: Joi.number().min(0).optional().default(0),
        unit_price:      Joi.number().min(0).required(),
        return_reason:   Joi.string().max(255).allow('', null).optional(),
      })
    )
    .required(),
}).required();

// FIX #15 — updateReturnSchema now also accepts items for replacement
const updateReturnSchema = Joi.object({
  return_date:    Joi.date().optional(),
  reason:         Joi.string().max(255).optional(),
  notes:          Joi.string().allow('', null).optional(),
  vehicle_number: Joi.string().max(50).allow('', null).optional(),
  items: Joi.array()
    .min(1)
    .items(
      Joi.object({
        grn_item_id:     Joi.string().uuid().allow(null).optional(),
        product_id:      Joi.string().uuid().required(),
        shade_id:        Joi.string().uuid().allow(null).optional(),
        batch_id:        Joi.string().uuid().allow(null).optional(),
        returned_boxes:  Joi.number().min(0).required(),
        returned_pieces: Joi.number().min(0).optional().default(0),
        unit_price:      Joi.number().min(0).required(),
        return_reason:   Joi.string().max(255).allow('', null).optional(),
      })
    )
    .optional(),
}).min(1);

const listQuerySchema = Joi.object({
  page:         Joi.number().integer().min(1).optional(),
  limit:        Joi.number().integer().min(1).max(500).optional(),
  search:       Joi.string().allow('').optional(),
  sortBy:       Joi.string().valid('return_number', 'return_date', 'created_at', 'status').optional(),
  sortOrder:    Joi.string().valid('asc', 'desc', 'ASC', 'DESC').optional(),
  status:       Joi.string().valid('draft', 'dispatched', 'acknowledged', 'cancelled').optional(),
  vendor_id:    Joi.string().uuid().optional(),
  warehouse_id: Joi.string().uuid().optional(),
});

module.exports = {
  createReturnSchema,
  updateReturnSchema,
  listQuerySchema,
};
