'use strict';
const Joi = require('joi');

const productSchema = Joi.object({
  categoryId: Joi.string().uuid().optional().allow(null, ''),
  name: Joi.string().min(2).max(255).required(),
  code: Joi.string().max(100).required(),
  description: Joi.string().max(2000).optional().allow(null, ''),
  sizeLengthMm: Joi.number().min(0).required(),
  sizeWidthMm: Joi.number().min(0).required(),
  sizeThicknessMm: Joi.number().min(0).optional().allow(null, ''),
  sizeLabel: Joi.string().max(50).required(),
  piecesPerBox: Joi.number().min(0).required(),
  sqftPerBox: Joi.number().min(0).required(),
  sqmtPerBox: Joi.number().min(0).optional().allow(null, ''),
  weightPerBoxKg: Joi.number().min(0).optional().allow(null, ''),
  finish: Joi.string().max(100).optional().allow(null, ''),
  material: Joi.string().max(100).optional().allow(null, ''),
  brand: Joi.string().max(100).optional().allow(null, ''),
  hsnCode: Joi.string().max(20).optional().allow(null, ''),
  gstRate: Joi.number().min(0).max(100).default(18),
  mrp: Joi.number().min(0).optional().allow(null, ''),
  reorderLevelBoxes: Joi.number().integer().min(0).default(0),
  barcode: Joi.string().max(100).optional().allow(null, ''),
  imageUrl: Joi.string().max(2000).optional().allow(null, ''),
  isActive: Joi.boolean().truthy('true', '1', 'yes').falsy('false', '0', 'no').default(true),
});


const updateProductSchema = Joi.object({
  categoryId: Joi.string().uuid().optional().allow(null, ''),
  name: Joi.string().min(2).max(255).optional(),
  code: Joi.string().max(100).optional(),
  description: Joi.string().max(2000).optional().allow(null, ''),
  sizeLengthMm: Joi.number().min(0).optional().allow(null, ''),
  sizeWidthMm: Joi.number().min(0).optional().allow(null, ''),
  sizeThicknessMm: Joi.number().min(0).optional().allow(null, ''),
  sizeLabel: Joi.string().max(50).optional().allow(null, ''),
  piecesPerBox: Joi.number().min(0).optional().allow(null, ''),
  sqftPerBox: Joi.number().min(0).optional().allow(null, ''),
  sqmtPerBox: Joi.number().min(0).optional().allow(null, ''),
  weightPerBoxKg: Joi.number().min(0).optional().allow(null, ''),
  finish: Joi.string().max(100).optional().allow(null, ''),
  material: Joi.string().max(100).optional().allow(null, ''),
  brand: Joi.string().max(100).optional().allow(null, ''),
  hsnCode: Joi.string().max(20).optional().allow(null, ''),
  gstRate: Joi.number().min(0).max(100).optional().allow(null, ''),
  mrp: Joi.number().min(0).optional().allow(null, ''),
  reorderLevelBoxes: Joi.number().integer().min(0).optional().allow(null, ''),
  barcode: Joi.string().max(100).optional().allow(null, ''),
  imageUrl: Joi.string().max(2000).optional().allow(null, ''),
  isActive: Joi.boolean().truthy('true', '1', 'yes').falsy('false', '0', 'no').optional(),
});

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

  // Ensure there is at least one valid field OR an uploaded file
  if (Object.keys(value).length === 0 && !req.file) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please provide at least one valid field or an image to update.',
        details: [{ field: 'request', message: 'No valid fields provided in the body.' }],
      },
    });
  }

  req.body = value;
  next();
};

module.exports = { productSchema, updateProductSchema, validate };
