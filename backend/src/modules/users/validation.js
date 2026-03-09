'use strict';
const Joi = require('joi');

const ROLES = ['super_admin', 'admin', 'warehouse_manager', 'sales', 'accountant', 'user'];
const VALID_ROLES = Object.freeze([...ROLES]);

const createUserSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid(...ROLES).required(),
  phone: Joi.string().max(20).allow(null, '').optional(),
});

const updateUserSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  password: Joi.string().min(6).allow(null, '').optional(),
  role: Joi.string().valid(...ROLES).optional(),
  phone: Joi.string().max(20).allow(null, '').optional(),
  is_active: Joi.boolean().optional(),
}).min(1);

// Allow role as string (e.g. "warehouse_manager,sales") or array (e.g. role[]=a&role[]=b); validated in service
const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
  search: Joi.string().max(255).allow('').optional(),
  sortBy: Joi.string().valid('name', 'email', 'role', 'created_at', 'last_login_at').optional(),
  sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').optional(),
  role: Joi.alternatives().try(Joi.string().max(255), Joi.array().items(Joi.string().valid(...ROLES))).optional(),
  roles: Joi.string().max(255).optional(), // alias: "warehouse_manager,sales"
  is_active: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
});

const validate = (schema, source = 'body') => (req, res, next) => {
  const target = source === 'query' ? req.query : req.body;
  const { error } = schema.validate(target, { abortEarly: false });
  if (error) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message,
        details: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      },
    });
  }
  next();
};

module.exports = { createUserSchema, updateUserSchema, listQuerySchema, validate, VALID_ROLES: Object.freeze([...ROLES]) };
