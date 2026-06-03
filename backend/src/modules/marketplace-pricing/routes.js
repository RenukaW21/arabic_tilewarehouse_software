'use strict';
const Joi = require('joi');
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

const upsertSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  platform:   Joi.string().valid('amazon', 'flipkart', 'meesho').required(),
  price:      Joi.number().min(0).required(),
});

const validateUpsert = (req, res, next) => {
  const { error, value } = upsertSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
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

router.use(authenticate);

router.get('/', ctrl.list);

router.post('/',
  requireRole(['super_admin', 'admin', 'warehouse_manager']),
  validateUpsert,
  ctrl.upsert
);

router.delete('/:productId/:platform',
  requireRole(['super_admin', 'admin']),
  ctrl.remove
);

module.exports = router;
