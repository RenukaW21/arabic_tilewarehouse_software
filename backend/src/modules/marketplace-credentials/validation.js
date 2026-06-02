'use strict';
const Joi = require('joi');

const saveSchema = Joi.object({
  display_name:     Joi.string().max(100).allow('', null),
  seller_id:        Joi.string().max(255).allow('', null),
  api_key:          Joi.string().max(2000).allow('', null),
  api_secret:       Joi.string().max(2000).allow('', null),
  access_token:     Joi.string().max(4000).allow('', null),
  refresh_token:    Joi.string().max(4000).allow('', null),
  token_expires_at: Joi.date().iso().allow(null),
  marketplace_id:   Joi.string().max(100).allow('', null),
  fulfillment_type: Joi.string().valid('fbm', 'fba').allow(null),
  is_active:        Joi.boolean(),
});

module.exports = { saveSchema };
