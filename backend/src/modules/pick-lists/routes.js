'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.put('/:id', requireMinRole('warehouse_manager'), ctrl.update);
router.delete('/:id', requireMinRole('warehouse_manager'), ctrl.remove);
router.patch('/:id/assign', requireMinRole('warehouse_manager'), ctrl.assign);
router.put('/:id/items/:itemId', requireMinRole('warehouse_manager'), ctrl.updateItemPicked);
router.post('/:id/complete', requireMinRole('warehouse_manager'), ctrl.complete);
router.post('/:id/reopen', requireMinRole('warehouse_manager'), ctrl.reopen);

module.exports = router;
