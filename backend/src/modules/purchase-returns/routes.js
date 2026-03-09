'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');
const { createReturnSchema, updateReturnSchema } = require('./validation');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', requireMinRole('warehouse_manager'), ctrl.validate(createReturnSchema), ctrl.create);
router.put('/:id', requireMinRole('warehouse_manager'), ctrl.validate(updateReturnSchema), ctrl.update);

module.exports = router;
