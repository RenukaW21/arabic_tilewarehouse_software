'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', requireMinRole('warehouse_manager'), ctrl.create);
router.post('/:id/load-from-stock', requireMinRole('warehouse_manager'), ctrl.loadFromStock);
router.put('/:id/items/:itemId', requireMinRole('warehouse_manager'), ctrl.updateItem);

module.exports = router;
