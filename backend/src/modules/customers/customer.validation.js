'use strict';

const Joi = require('joi');

const createCustomerSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  code: Joi.string().max(50).allow(null, ''),
  contact_person: Joi.string().max(255).allow(null, ''),
  phone: Joi.string().max(20).allow(null, ''),
  email: Joi.string().email().allow(null, ''),
  billing_address: Joi.string().allow(null, ''),
  shipping_address: Joi.string().allow(null, ''),
  gstin: Joi.string().max(20).allow(null, ''),
  state_code: Joi.string().max(5).allow(null, ''),
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
