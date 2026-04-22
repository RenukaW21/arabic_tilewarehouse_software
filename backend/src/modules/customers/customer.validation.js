'use strict';

const Joi = require('joi');

const createCustomerSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  code: Joi.string().max(50).allow(null, ''),
  contact_person: Joi.string().max(255).allow(null, ''),
  phone: Joi.string().pattern(/^\d{10}$/).allow(null, '').messages({
    'string.pattern.base': 'Phone number must be exactly 10 digits'
  }),
  email: Joi.string().email().allow(null, ''),
  billing_address: Joi.string().allow(null, ''),
  shipping_address: Joi.string().allow(null, ''),
  gstin: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).allow(null, '').messages({
    'string.pattern.base': 'Invalid GSTIN format'
  }),
  state_code: Joi.string().pattern(/^[0-9]{2}$/).allow(null, '').messages({
    'string.pattern.base': 'State code must be 2 digits'
  }),
  credit_limit: Joi.number().min(0).allow(null).empty('').default(null),
  payment_terms_days: Joi.number().integer().min(0).allow(null).empty('').default(null),
  is_active: Joi.boolean().default(true),
});

const updateCustomerSchema = createCustomerSchema.min(1);

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().max(100).allow('').optional(),
  sortBy: Joi.string().valid('name', 'code', 'created_at').optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
  is_active: Joi.any().optional(),
});

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
  listQuerySchema,
};
