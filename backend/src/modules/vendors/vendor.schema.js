// validations/vendor.schema.js
const Joi = require("joi");

const createVendorSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  code: Joi.string().max(50).allow(null, ""),
  contact_person: Joi.string().max(255).allow(null, ""),
  phone: Joi.string().max(20).allow(null, ""),
  email: Joi.string().email().allow(null, ""),
  address: Joi.string().allow(null, ""),
  gstin: Joi.string().max(20).allow(null, ""),
  pan: Joi.string().max(20).allow(null, ""),
  payment_terms_days: Joi.number().integer().min(0).default(30),
  is_active: Joi.boolean().default(true),
});

const updateVendorSchema = createVendorSchema.min(1);

module.exports = {
  createVendorSchema,
  updateVendorSchema,
};