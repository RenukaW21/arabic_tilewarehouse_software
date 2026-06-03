'use strict';

const router = require('express').Router();
const Joi = require('joi');
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

const manageRoles = ['super_admin', 'admin', 'sales', 'accountant'];
const viewRoles = ['super_admin', 'admin', 'sales', 'accountant', 'viewer'];

const promotionSchema = Joi.object({
  name:               Joi.string().trim().min(1).max(255).required(),
  description:        Joi.string().trim().max(1000).allow('', null).optional(),
  offer_type:         Joi.string().valid('points_multiplier', 'cashback').required(),
  points_multiplier:  Joi.number().min(0).default(1),
  cashback_percent:   Joi.number().min(0).max(100).default(0),
  start_date:         Joi.date().iso().optional(),
  end_date:           Joi.date().iso().min(Joi.ref('start_date')).allow(null).optional(),
  is_active:          Joi.boolean().default(true),
});

const validatePromotion = (req, res, next) => {
  const { error, value } = promotionSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
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

router.get('/overview', requireRole(viewRoles), ctrl.getOverview);
router.get('/settings', requireRole(viewRoles), ctrl.getSettings);
router.put('/settings', requireRole(['super_admin', 'admin']), ctrl.updateSettings);
router.get('/customers', requireRole(viewRoles), ctrl.getCustomers);
router.get('/transactions', requireRole(viewRoles), ctrl.getTransactions);
router.post('/transactions', requireRole(manageRoles), ctrl.createTransaction);
router.get('/promotions', requireRole(viewRoles), ctrl.getPromotions);
router.post('/promotions', requireRole(manageRoles), validatePromotion, ctrl.createPromotion);
router.put('/promotions/:id', requireRole(manageRoles), validatePromotion, ctrl.updatePromotion);
router.get('/referrals', requireRole(viewRoles), ctrl.getReferrals);
router.post('/referrals', requireRole(manageRoles), ctrl.createReferral);
router.post('/referrals/:id/complete', requireRole(manageRoles), ctrl.completeReferral);

module.exports = router;
