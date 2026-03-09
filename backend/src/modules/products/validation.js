'use strict';
const Joi = require('joi');

const productSchema = Joi.object({
  categoryId:        Joi.string().uuid().optional().allow(null),
  name:              Joi.string().min(2).max(255).required(),
  code:              Joi.string().max(100).required(),
  description:       Joi.string().max(2000).optional().allow(null, ''),
  sizeLengthMm:      Joi.number().positive().required(),
  sizeWidthMm:       Joi.number().positive().required(),
  sizeThicknessMm:   Joi.number().positive().optional().allow(null),
  sizeLabel:         Joi.string().max(50).required(),
  piecesPerBox:      Joi.number().positive().required(),
  sqftPerBox:        Joi.number().positive().required(),
  sqmtPerBox:        Joi.number().positive().optional().allow(null),
  weightPerBoxKg:    Joi.number().positive().optional().allow(null),
  finish:            Joi.string().max(100).optional().allow(null, ''),
  material:          Joi.string().max(100).optional().allow(null, ''),
  brand:             Joi.string().max(100).optional().allow(null, ''),
  hsnCode:           Joi.string().max(20).optional().allow(null, ''),
  gstRate:           Joi.number().min(0).max(100).default(18),
  mrp:               Joi.number().positive().optional().allow(null),
  reorderLevelBoxes: Joi.number().integer().min(0).default(0),
  barcode:           Joi.string().max(100).optional().allow(null, ''),
  imageUrl:          Joi.string().max(2000).optional().allow(null, ''),
  isActive:          Joi.boolean().default(true),
});


const updateProductSchema = Joi.object({
  categoryId:        Joi.string().uuid().optional().allow(null),

  name:              Joi.string().min(2).max(255).optional(),

  code:              Joi.string().max(100).optional(),

  description:       Joi.string().max(2000).optional().allow(null, ''),

  sizeLengthMm:      Joi.number().positive().optional(),

  sizeWidthMm:       Joi.number().positive().optional(),

  sizeThicknessMm:   Joi.number().positive().optional().allow(null),

  sizeLabel:         Joi.string().max(50).optional(),

  piecesPerBox:      Joi.number().positive().optional(),

  sqftPerBox:        Joi.number().positive().optional(),

  sqmtPerBox:        Joi.number().positive().optional().allow(null),

  weightPerBoxKg:    Joi.number().positive().optional().allow(null),

  finish:            Joi.string().max(100).optional().allow(null, ''),

  material:          Joi.string().max(100).optional().allow(null, ''),

  brand:             Joi.string().max(100).optional().allow(null, ''),

  hsnCode:           Joi.string().max(20).optional().allow(null, ''),

  gstRate:           Joi.number().min(0).max(100).optional(),

  mrp:               Joi.number().positive().optional().allow(null),

  reorderLevelBoxes: Joi.number().integer().min(0).optional(),

  barcode:           Joi.string().max(100).optional().allow(null, ''),

  imageUrl:          Joi.string().uri().max(2000).optional().allow(null, ''),

  isActive:          Joi.boolean().optional(),

}).min(1);

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });
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
  req.body = value;
  next();
};

module.exports = { productSchema,updateProductSchema, validate };
