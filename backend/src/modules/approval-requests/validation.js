'use strict';
const Joi = require('joi');

const VALID_TYPES = [
  'inventory_adjustment',
  'production_entry',
  'purchase_approval',
  'pricing_change',
  'marketplace_update',
  'report_validation',
];

const createSchema = Joi.object({
  request_type:   Joi.string().valid(...VALID_TYPES).required(),
  reference_id:   Joi.string().uuid().required(),
  reference_type: Joi.string().max(50).required(),
  title:          Joi.string().max(255).required(),
  description:    Joi.string().max(2000).allow('', null).optional(),
  payload:        Joi.object().allow(null).optional(),
});

const approveRejectSchema = Joi.object({
  review_notes: Joi.string().max(1000).allow('', null).optional(),
});

module.exports = { createSchema, approveRejectSchema };
