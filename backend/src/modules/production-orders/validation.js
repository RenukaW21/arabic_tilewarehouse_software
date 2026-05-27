'use strict';
const Joi = require('joi');

const PROD_STATUS = ['draft', 'in_progress', 'completed', 'cancelled'];

const materialShape = {
  id:          Joi.string().uuid().optional(),
  product_id:  Joi.string().uuid().required(),
  planned_qty: Joi.number().min(0).required(),
  actual_qty:  Joi.number().min(0).default(0).optional(),
  unit_cost:   Joi.number().min(0).default(0).optional(),
};

const outputShape = {
  id:          Joi.string().uuid().optional(),
  product_id:  Joi.string().uuid().required(),
  planned_qty: Joi.number().min(0).required(),
  actual_qty:  Joi.number().min(0).default(0).optional(),
  wastage_qty: Joi.number().min(0).default(0).optional(),
  unit_cost:   Joi.number().min(0).default(0).optional(),
};

const createSchema = Joi.object({
  warehouse_id:  Joi.string().uuid().required(),
  planned_date:  Joi.date().iso().required(),
  labor_cost:    Joi.number().min(0).default(0).optional(),
  machine_cost:  Joi.number().min(0).default(0).optional(),
  wastage_cost:  Joi.number().min(0).default(0).optional(),
  notes:         Joi.string().allow(null, '').optional(),
  materials:     Joi.array().items(Joi.object(materialShape)).min(0).default([]).optional(),
  outputs:       Joi.array().items(Joi.object(outputShape)).min(0).default([]).optional(),
});

const updateSchema = Joi.object({
  warehouse_id:     Joi.string().uuid().optional(),
  planned_date:     Joi.date().iso().optional(),
  completion_date:  Joi.date().iso().allow(null).optional(),
  labor_cost:       Joi.number().min(0).optional(),
  machine_cost:     Joi.number().min(0).optional(),
  wastage_cost:     Joi.number().min(0).optional(),
  notes:            Joi.string().allow(null, '').optional(),
  materials:        Joi.array().items(Joi.object(materialShape)).optional(),
  outputs:          Joi.array().items(Joi.object(outputShape)).optional(),
}).min(1);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...PROD_STATUS).required(),
});

const listQuerySchema = Joi.object({
  page:         Joi.number().integer().min(1).optional(),
  limit:        Joi.number().integer().min(1).max(500).optional(),
  search:       Joi.string().max(100).allow('').optional(),
  sortBy:       Joi.string().valid('order_number', 'planned_date', 'created_at', 'status').optional(),
  sortOrder:    Joi.string().valid('ASC', 'DESC').optional(),
  status:       Joi.string().valid(...PROD_STATUS).optional(),
  warehouse_id: Joi.string().uuid().optional(),
});

module.exports = { createSchema, updateSchema, updateStatusSchema, listQuerySchema, PROD_STATUS };
