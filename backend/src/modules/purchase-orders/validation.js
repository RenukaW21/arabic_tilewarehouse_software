'use strict';
const Joi = require('joi');

const PO_STATUS      = ['draft', 'confirmed', 'partial', 'received', 'cancelled'];
const RETURN_STATUS  = ['none', 'partial', 'full'];
const PAYMENT_STATUS = ['pending', 'partial', 'paid'];

// ─── ITEM SHAPE (reused in create / update) ───────────────────────────────────
const poItemShape = {
  product_id:     Joi.string().uuid().required(),
  shade_id:       Joi.string().uuid().allow(null, '').optional(),
  ordered_boxes:  Joi.number().min(0).required(),
  ordered_pieces: Joi.number().min(0).allow(null).optional(),
  unit_price:     Joi.number().min(0).required(),
  discount_pct:   Joi.number().min(0).max(100).allow(null).optional(),
  tax_pct:        Joi.number().min(0).max(100).allow(null).optional(),
};

// ─── CREATE PO ────────────────────────────────────────────────────────────────
const createPOSchema = Joi.object({
  vendor_id:           Joi.string().uuid().required(),
  warehouse_id:        Joi.string().uuid().required(),
  order_date:          Joi.date().iso().required(),
  expected_date:       Joi.date().iso().allow(null).optional(),
  additional_discount: Joi.number().min(0).default(0).optional(),
  notes:               Joi.string().allow(null, '').optional(),
  items: Joi.array()
    .items(Joi.object(poItemShape))
    .min(1)
    .required(),
});

// ─── UPDATE PO ────────────────────────────────────────────────────────────────
const updatePOSchema = Joi.object({
  vendor_id:           Joi.string().uuid().optional(),
  warehouse_id:        Joi.string().uuid().optional(),
  order_date:          Joi.date().iso().optional(),
  expected_date:       Joi.date().iso().allow(null).optional(),
  notes:               Joi.string().allow(null, '').optional(),
  additional_discount: Joi.number().min(0).optional(),
  received_date:       Joi.date().iso().allow(null).optional(),
  items: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().uuid().optional(),
        ...poItemShape,
      })
    )
    .optional(),
}).min(1);

// ─── UPDATE PO STATUS ─────────────────────────────────────────────────────────
const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...PO_STATUS).required(),
});

// ─── UPDATE RECEIVED DATE (non-draft only) ────────────────────────────────────
const updateReceivedDateSchema = Joi.object({
  received_date: Joi.date().iso().allow(null).required(),
});

// ─── CREATE PO ITEM ───────────────────────────────────────────────────────────
const createPOItemSchema = Joi.object(poItemShape);

// ─── UPDATE PO ITEM ───────────────────────────────────────────────────────────
const updatePOItemSchema = Joi.object(poItemShape);

// ─── RECEIVE ITEM ─────────────────────────────────────────────────────────────
const receiveItemSchema = Joi.object({
  received_boxes: Joi.number().min(0).required(),
});

// ─── PAYMENT STATUS ───────────────────────────────────────────────────────────
const paymentStatusSchema = Joi.object({
  payment_status: Joi.string().valid(...PAYMENT_STATUS).required(),
});

// ─── LIST QUERY ───────────────────────────────────────────────────────────────
const listQuerySchema = Joi.object({
  page:               Joi.number().integer().min(1).optional(),
  limit:              Joi.number().integer().min(1).max(500).optional(),
  search:             Joi.string().max(100).allow('').optional(),
  sortBy:             Joi.string().valid('po_number', 'order_date', 'created_at', 'status').optional(),
  sortOrder:          Joi.string().valid('ASC', 'DESC').optional(),
  status:             Joi.string().valid(...PO_STATUS).optional(),
  return_status:      Joi.string().valid(...RETURN_STATUS).optional(),
  payment_status:     Joi.string().valid(...PAYMENT_STATUS).optional(),
  vendor_id:          Joi.string().uuid().optional(),
  warehouse_id:       Joi.string().uuid().optional(),
  received_date_from: Joi.date().iso().optional(),
  received_date_to:   Joi.date().iso().optional(),
});

module.exports = {
  createPOSchema,
  updatePOSchema,
  updateStatusSchema,
  updateReceivedDateSchema,
  createPOItemSchema,
  updatePOItemSchema,
  receiveItemSchema,
  paymentStatusSchema,
  listQuerySchema,
  PO_STATUS,
  RETURN_STATUS,
  PAYMENT_STATUS,
};
