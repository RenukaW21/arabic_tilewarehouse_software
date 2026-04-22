'use strict';

const Joi = require('joi');

/** Validation for create vendor body. */
const createVendorSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  code: Joi.string().max(50).allow(null, ''),
  contact_person: Joi.string().max(255).allow(null, ''),
  phone: Joi.string().pattern(/^\d{10}$/).allow(null, '').messages({
    'string.pattern.base': 'Phone number must be exactly 10 digits'
  }),
  email: Joi.string().email().allow(null, ''),
  address: Joi.string().allow(null, ''),
  gstin: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).allow(null, '').messages({
    'string.pattern.base': 'Invalid GSTIN format'
  }),
  pan: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).allow(null, '').messages({
    'string.pattern.base': 'Invalid PAN format'
  }),
  payment_terms_days: Joi.number().integer().min(0).default(30),
  is_active: Joi.boolean().default(true),
});

/** Validation for update vendor body (at least one field). */
const updateVendorSchema = createVendorSchema.min(1);

/** Optional query validation for list (page, limit, search, sort). */
const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().max(100).allow('').optional(),
  sortBy: Joi.string().valid('name', 'code', 'created_at').optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
  is_active: Joi.any().optional(),
});

module.exports = {
  createVendorSchema,
  updateVendorSchema,
  listQuerySchema,
};
