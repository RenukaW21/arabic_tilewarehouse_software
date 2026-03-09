'use strict';
const Joi = require('joi');

// GSTIN: 15 chars, pattern 2 digit state + 10 char PAN + 2 digit entity + Z + 1 check
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const stateCodeRegex = /^[0-9]{2}$/;

const createSchema = Joi.object({
  gstin: Joi.string().pattern(gstinRegex).max(20).required().messages({
    'string.pattern.base': 'GSTIN must be valid (15 characters: 2 state + 10 PAN + 2 entity + Z + 1)',
  }),
  legal_name: Joi.string().min(1).max(255).required(),
  trade_name: Joi.string().max(255).allow(null, '').optional(),
  state_code: Joi.string().pattern(stateCodeRegex).length(2).required().messages({
    'string.pattern.base': 'State code must be 2 digits',
  }),
  state_name: Joi.string().min(1).max(100).required(),
  pan: Joi.string().max(20).allow(null, '').optional(),
  default_gst_rate: Joi.number().min(0).max(100).optional().default(18),
  fiscal_year_start: Joi.string().max(5).optional().default('04-01'),
  invoice_prefix: Joi.string().max(20).allow(null, '').optional(),
  is_composition_scheme: Joi.boolean().optional().default(false),
});

const updateSchema = Joi.object({
  gstin: Joi.string().pattern(gstinRegex).max(20).optional(),
  legal_name: Joi.string().min(1).max(255).optional(),
  trade_name: Joi.string().max(255).allow(null, '').optional(),
  state_code: Joi.string().pattern(stateCodeRegex).length(2).optional(),
  state_name: Joi.string().min(1).max(100).optional(),
  pan: Joi.string().max(20).allow(null, '').optional(),
  default_gst_rate: Joi.number().min(0).max(100).optional(),
  fiscal_year_start: Joi.string().max(5).optional(),
  invoice_prefix: Joi.string().max(20).allow(null, '').optional(),
  is_composition_scheme: Joi.boolean().optional(),
}).min(1);

module.exports = { createSchema, updateSchema };
