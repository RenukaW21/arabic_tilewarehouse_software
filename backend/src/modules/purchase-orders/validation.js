'use strict';
const Joi = require('joi');

const PO_STATUS = ['draft', 'confirmed', 'partial', 'received', 'cancelled'];

const createPOSchema = Joi.object({
  vendor_id: Joi.string().uuid().required(),
  warehouse_id: Joi.string().uuid().required(),
  order_date: Joi.date().iso().required(),
  expected_date: Joi.date().iso().allow(null),
  notes: Joi.string().allow(null, ''),
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.string().uuid().required(),
        shade_id: Joi.string().uuid().allow(null),
        ordered_boxes: Joi.number().min(0).required(),
        ordered_pieces: Joi.number().min(0).allow(null),
        unit_price: Joi.number().min(0).required(),
        discount_pct: Joi.number().min(0).max(100).allow(null),
        tax_pct: Joi.number().min(0).max(100).allow(null),
      })
    )
    .min(1)
    .required(),
});

const updatePOSchema = Joi.object({
  vendor_id: Joi.string().uuid(),
  warehouse_id: Joi.string().uuid(),
  order_date: Joi.date().iso(),
  expected_date: Joi.date().iso().allow(null),
  notes: Joi.string().allow(null, ''),
  items: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid(),
      product_id: Joi.string().uuid().required(),
      shade_id: Joi.string().uuid().allow(null),
      ordered_boxes: Joi.number().min(0).required(),
      ordered_pieces: Joi.number().min(0).allow(null),
      unit_price: Joi.number().min(0).required(),
      discount_pct: Joi.number().min(0).max(100).allow(null),
      tax_pct: Joi.number().min(0).max(100).allow(null),
    })
  ),
}).min(1);

const createPOItemSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  shade_id: Joi.string().uuid().allow(null),
  ordered_boxes: Joi.number().min(0).required(),
  ordered_pieces: Joi.number().min(0).allow(null),
  unit_price: Joi.number().min(0).required(),
  discount_pct: Joi.number().min(0).max(100).allow(null),
  tax_pct: Joi.number().min(0).max(100).allow(null),
});

const updatePOItemSchema = createPOItemSchema;

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
  search: Joi.string().max(100).allow('').optional(),
  sortBy: Joi.string().valid('po_number', 'order_date', 'created_at', 'status').optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
  status: Joi.string().valid(...PO_STATUS).optional(),
  vendor_id: Joi.string().uuid().optional(),
  warehouse_id: Joi.string().uuid().optional(),
});

module.exports = {
  createPOSchema,
  updatePOSchema,
  createPOItemSchema,
  updatePOItemSchema,
  listQuerySchema,
  PO_STATUS,
};
