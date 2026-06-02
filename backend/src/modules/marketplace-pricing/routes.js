'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

router.use(authenticate);

router.get('/', ctrl.list);

router.post('/',
  requireRole(['super_admin', 'admin', 'warehouse_manager']),
  ctrl.upsert
);

router.delete('/:productId/:platform',
  requireRole(['super_admin', 'admin']),
  ctrl.remove
);

module.exports = router;
