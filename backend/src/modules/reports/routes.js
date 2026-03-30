'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

router.use(authenticate);
router.get('/dashboard',       ctrl.dashboard);
router.get('/gst',             requireRole(['super_admin','admin','accountant','warehouse_manager','viewer']), ctrl.gstReport);
router.get('/revenue',         requireRole(['super_admin','admin','accountant','warehouse_manager','viewer']), ctrl.revenueReport);
router.get('/aging',           requireRole(['super_admin','admin','accountant','warehouse_manager','viewer']), ctrl.agingReport);
router.get('/stock-valuation', requireRole(['super_admin','admin','accountant','warehouse_manager', 'viewer']), ctrl.stockValuation);
module.exports = router;
