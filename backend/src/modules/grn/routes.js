'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');
const {
  createGRNSchema,
  updateGRNSchema,
  addGRNItemSchema,
  updateGRNItemSchema,
  updateQualitySchema,
} = require('./validation');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);

// FIX #12 — validation middleware now applied on create and addItem
router.post('/', requireMinRole('warehouse_manager'), ctrl.validate(createGRNSchema), ctrl.create);
router.put('/:id', requireMinRole('warehouse_manager'), ctrl.validate(updateGRNSchema), ctrl.update);
router.delete('/:id', requireMinRole('warehouse_manager'), ctrl.remove);

router.post('/:id/post', requireMinRole('warehouse_manager'), ctrl.postGRN);
router.post('/:id/items', requireMinRole('warehouse_manager'), ctrl.validate(addGRNItemSchema), ctrl.addItem);
router.put('/:id/items/:itemId', requireMinRole('warehouse_manager'), ctrl.validate(updateGRNItemSchema), ctrl.updateItem);
router.delete('/:id/items/:itemId', requireMinRole('warehouse_manager'), ctrl.deleteItem);
router.post('/:id/items/:itemId/labels', requireMinRole('warehouse_manager'), ctrl.generateLabels);
router.put('/:id/items/:itemId/quality', requireMinRole('warehouse_manager'), ctrl.validate(updateQualitySchema), ctrl.updateQuality);

module.exports = router;
