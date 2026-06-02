'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

router.use(authenticate);

router.get('/',       ctrl.list);
router.get('/stats',  ctrl.stats);
router.get('/:id',    ctrl.getById);

router.patch('/:id/status',
  requireRole(['super_admin', 'admin', 'warehouse_manager', 'supervisor']),
  ctrl.updateStatus
);

module.exports = router;
