'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', requireMinRole('warehouse_manager'), ctrl.validateCreate, ctrl.create);
router.put('/:id', requireMinRole('warehouse_manager'), ctrl.validateUpdate, ctrl.update);
router.delete('/:id', requireMinRole('warehouse_manager'), ctrl.remove);
router.post('/:id/receive', requireMinRole('warehouse_manager'), ctrl.receive);

module.exports = router;
