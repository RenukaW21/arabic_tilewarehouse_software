'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

router.use(authenticate);
router.use(requireRole(['super_admin', 'admin', 'warehouse_manager']));

router.get('/health', ctrl.health);
router.get('/logs',   ctrl.logs);

module.exports = router;
