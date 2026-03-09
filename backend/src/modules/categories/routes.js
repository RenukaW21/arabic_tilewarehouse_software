'use strict';

const router = require('express').Router();
const ctrl = require('./controller');

const { authenticate } = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);

router.post('/', requireMinRole('admin'), ctrl.create);
router.put('/:id', requireMinRole('admin'), ctrl.update);
router.delete('/:id', requireMinRole('admin'), ctrl.remove);

module.exports = router;