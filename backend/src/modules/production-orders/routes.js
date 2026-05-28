'use strict';

const router = require('express').Router();
const ctrl   = require('./controller');
const { authenticate }   = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');
const { createSchema, updateSchema, updateStatusSchema } = require('./validation');

router.use(authenticate);

// ─── READ ─────────────────────────────────────────────────────────────────────
// Named sub-routes MUST come before /:id to avoid param conflict
router.get('/materials',    ctrl.getAllMaterials);
router.get('/outputs',      ctrl.getAllOutputs);
router.get('/cost-summary', ctrl.getCostSummary);

router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);

// ─── WRITE ────────────────────────────────────────────────────────────────────
router.post('/',    requireMinRole('warehouse_manager'), ctrl.validate(createSchema),      ctrl.create);
router.put('/:id',  requireMinRole('warehouse_manager'), ctrl.validate(updateSchema),      ctrl.update);
router.delete('/:id', requireMinRole('warehouse_manager'), ctrl.remove);

// ─── STATUS ───────────────────────────────────────────────────────────────────
router.patch('/:id/status', requireMinRole('warehouse_manager'), ctrl.validate(updateStatusSchema), ctrl.updateStatus);

module.exports = router;
