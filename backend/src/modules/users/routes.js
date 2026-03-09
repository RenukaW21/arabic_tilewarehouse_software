'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { createUserSchema, updateUserSchema, listQuerySchema, validate } = require('./validation');

router.use(authenticate);

router.get('/', requireRole(['super_admin', 'admin']), validate(listQuerySchema, 'query'), ctrl.list);
router.get('/:id', requireRole(['super_admin', 'admin']), ctrl.getById);
router.post('/', requireRole(['super_admin', 'admin']), validate(createUserSchema), ctrl.create);
router.put('/:id', requireRole(['super_admin', 'admin']), validate(updateUserSchema), ctrl.update);
router.delete('/:id', requireRole(['super_admin', 'admin']), ctrl.remove);

module.exports = router;
