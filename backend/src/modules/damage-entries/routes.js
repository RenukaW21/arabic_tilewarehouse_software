'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');
const { createSchema, updateSchema } = require('./validation');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', requireMinRole('warehouse_manager'), ctrl.validate(createSchema), ctrl.create);
router.put('/:id', requireMinRole('warehouse_manager'), ctrl.validate(updateSchema), ctrl.update);
router.delete('/:id', requireMinRole('warehouse_manager'), ctrl.remove);

module.exports = router;
