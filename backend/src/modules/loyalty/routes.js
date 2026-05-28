'use strict';

const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

const manageRoles = ['super_admin', 'admin', 'sales', 'accountant'];
const viewRoles = ['super_admin', 'admin', 'sales', 'accountant', 'viewer'];

router.use(authenticate);

router.get('/overview', requireRole(viewRoles), ctrl.getOverview);
router.get('/settings', requireRole(viewRoles), ctrl.getSettings);
router.put('/settings', requireRole(['super_admin', 'admin']), ctrl.updateSettings);
router.get('/customers', requireRole(viewRoles), ctrl.getCustomers);
router.get('/transactions', requireRole(viewRoles), ctrl.getTransactions);
router.post('/transactions', requireRole(manageRoles), ctrl.createTransaction);
router.get('/promotions', requireRole(viewRoles), ctrl.getPromotions);
router.post('/promotions', requireRole(manageRoles), ctrl.createPromotion);
router.put('/promotions/:id', requireRole(manageRoles), ctrl.updatePromotion);
router.get('/referrals', requireRole(viewRoles), ctrl.getReferrals);
router.post('/referrals', requireRole(manageRoles), ctrl.createReferral);
router.post('/referrals/:id/complete', requireRole(manageRoles), ctrl.completeReferral);

module.exports = router;
