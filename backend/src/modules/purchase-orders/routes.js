'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);

router.post('/', requireMinRole('warehouse_manager'), ctrl.validate(require('./validation').createPOSchema), ctrl.create);
router.put('/:id', requireMinRole('warehouse_manager'), ctrl.validate(require('./validation').updatePOSchema), ctrl.update);
router.delete('/:id', requireMinRole('warehouse_manager'), ctrl.remove);
router.post('/:id/approve', requireMinRole('warehouse_manager'), ctrl.approve);

router.post('/:id/items', requireMinRole('warehouse_manager'), ctrl.validate(require('./validation').createPOItemSchema), ctrl.addItem);
router.put('/:id/items/:itemId', requireMinRole('warehouse_manager'), ctrl.validate(require('./validation').updatePOItemSchema), ctrl.updateItem);
router.delete('/:id/items/:itemId', requireMinRole('warehouse_manager'), ctrl.deleteItem);

module.exports = router;
