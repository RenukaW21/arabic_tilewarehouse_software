'use strict';
const Joi = require('joi');
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

const updateStatusSchema = Joi.object({
  status:              Joi.string().valid('pending','confirmed','shipped','delivered','cancelled','returned').required(),
  tracking_number:     Joi.string().trim().max(255).allow('', null).optional(),
  shipped_at:          Joi.string().isoDate().allow(null).optional(),
  wms_sales_order_id:  Joi.string().uuid().allow(null).optional(),
});

const validateUpdateStatus = (req, res, next) => {
  const { error, value } = updateStatusSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
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

router.get('/',       ctrl.list);
router.get('/stats',  ctrl.stats);
router.get('/:id',    ctrl.getById);

router.patch('/:id/status',
  requireRole(['super_admin', 'admin', 'warehouse_manager', 'supervisor']),
  validateUpdateStatus,
  ctrl.updateStatus
);

module.exports = router;
