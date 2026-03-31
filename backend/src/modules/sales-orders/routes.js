'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { attachWarehouseScope } = require('../../middlewares/warehouse-scope.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

router.use(authenticate);
router.use(attachWarehouseScope);

router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/',   requireRole(['super_admin','admin','sales']), ctrl.create);
router.put('/:id', requireRole(['super_admin','admin','warehouse_manager','sales']), ctrl.update);
router.delete('/:id', requireRole(['super_admin','admin','warehouse_manager','sales']), ctrl.remove);
router.post('/:id/confirm', requireRole(['super_admin','admin','sales']), ctrl.confirmOrder);

module.exports = router;
