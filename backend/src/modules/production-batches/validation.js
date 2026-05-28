'use strict';
const Joi = require('joi');

const BATCH_STATUS = ['pending', 'in_progress', 'completed', 'rejected'];

const createSchema = Joi.object({
  production_order_id: Joi.string().uuid().allow(null, '').optional(),
  warehouse_id:        Joi.string().uuid().required(),
  product_id:          Joi.string().uuid().allow(null, '').optional(),
  quantity_planned:    Joi.number().min(0).required(),
  start_date:          Joi.date().iso().allow(null).optional(),
  notes:               Joi.string().allow(null, '').optional(),
});

const updateSchema = Joi.object({
  production_order_id: Joi.string().uuid().allow(null, '').optional(),
  warehouse_id:        Joi.string().uuid().optional(),
  product_id:          Joi.string().uuid().allow(null, '').optional(),
  quantity_planned:    Joi.number().min(0).optional(),
  quantity_produced:   Joi.number().min(0).optional(),
  wastage_qty:         Joi.number().min(0).optional(),
  start_date:          Joi.date().iso().allow(null).optional(),
  end_date:            Joi.date().iso().allow(null).optional(),
  notes:               Joi.string().allow(null, '').optional(),
}).min(1);

const updateStatusSchema = Joi.object({
  status:            Joi.string().valid(...BATCH_STATUS).required(),
  quantity_produced: Joi.number().min(0).optional(),
  wastage_qty:       Joi.number().min(0).optional(),
  end_date:          Joi.date().iso().allow(null).optional(),
});

const listQuerySchema = Joi.object({
  page:                Joi.number().integer().min(1).optional(),
  limit:               Joi.number().integer().min(1).max(500).optional(),
  search:              Joi.string().max(100).allow('').optional(),
  sortBy:              Joi.string().valid('batch_number','start_date','created_at','status').optional(),
  sortOrder:           Joi.string().valid('ASC','DESC').optional(),
  status:              Joi.string().valid(...BATCH_STATUS).optional(),
  warehouse_id:        Joi.string().uuid().optional(),
  production_order_id: Joi.string().uuid().optional(),
});

module.exports = { createSchema, updateSchema, updateStatusSchema, listQuerySchema, BATCH_STATUS };
