'use strict';
const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  tenantSlug: Joi.string().pattern(/^[a-z0-9-]+$/).min(2).max(50).required()
    .messages({ 'string.pattern.base': '"tenantSlug" must only contain lowercase letters, numbers, or hyphens' }),
});

const registerTenantSchema = Joi.object({
  tenantName: Joi.string().min(2).max(255).required(),
  tenantSlug: Joi.string().pattern(/^[a-z0-9-]+$/).min(2).max(50).required()
    .messages({ 'string.pattern.base': '"tenantSlug" must only contain lowercase letters, numbers, or hyphens' }),
  plan: Joi.string().valid('basic', 'pro', 'enterprise').default('trial'),
  adminName: Joi.string().min(2).max(255).required(),
  adminEmail: Joi.string().email().required(),
  adminPassword: Joi.string().min(8).max(100).required(),
  adminPhone: Joi.string().max(20).optional(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(100).required(),
  confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'Passwords do not match' }),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
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

module.exports = { loginSchema, registerTenantSchema, refreshTokenSchema, changePasswordSchema, validate };
