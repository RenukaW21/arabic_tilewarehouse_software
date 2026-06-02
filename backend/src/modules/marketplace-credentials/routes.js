'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

const ADMIN_ROLES = ['super_admin', 'admin'];

router.use(authenticate);
router.use(requireRole(ADMIN_ROLES));

router.get('/',                          ctrl.list);
router.get('/:platform',                 ctrl.getByPlatform);
router.put('/:platform', ctrl.validate(require('./validation').saveSchema), ctrl.save);
router.delete('/:id',                    ctrl.remove);

module.exports = router;
