'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');

router.use(authenticate);

router.get('/',                           ctrl.getAll);
router.get('/:id',                        ctrl.getById);
router.post('/',   requireMinRole('warehouse_manager'), ctrl.create);
router.post('/:id/post',  requireMinRole('warehouse_manager'), ctrl.postGRN);
router.put('/:id/items/:itemId/quality', requireMinRole('warehouse_manager'), ctrl.updateQuality);

module.exports = router;
