'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');
const {
  createPOSchema,
  updatePOSchema,
  updateStatusSchema,
  updateReceivedDateSchema,
  createPOItemSchema,
  updatePOItemSchema,
  receiveItemSchema,
  paymentStatusSchema,
} = require('./validation');

router.use(authenticate);

// ─── READ ─────────────────────────────────────────────────────────────────────
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);

// ─── WRITE ────────────────────────────────────────────────────────────────────
router.post('/',    requireMinRole('warehouse_manager'), ctrl.validate(createPOSchema),  ctrl.create);
router.put('/:id',  requireMinRole('warehouse_manager'), ctrl.validate(updatePOSchema),  ctrl.update);
router.delete('/:id', requireMinRole('warehouse_manager'), ctrl.remove);

// ─── STATUS TRANSITIONS ───────────────────────────────────────────────────────
router.post('/:id/approve',         requireMinRole('warehouse_manager'), ctrl.approve);
// FIX #2 — new route: change PO status manually
router.patch('/:id/status',         requireMinRole('warehouse_manager'), ctrl.validate(updateStatusSchema), ctrl.updateStatus);
// FIX #4 — separate route for received_date (non-draft only)
router.patch('/:id/received-date',  requireMinRole('warehouse_manager'), ctrl.validate(updateReceivedDateSchema), ctrl.updateReceivedDate);
router.patch('/:id/payment-status', requireMinRole('warehouse_manager'), ctrl.validate(paymentStatusSchema), ctrl.updatePaymentStatus);

// ─── ITEMS ────────────────────────────────────────────────────────────────────
router.post('/:id/items',                          requireMinRole('warehouse_manager'), ctrl.validate(createPOItemSchema), ctrl.addItem);
router.put('/:id/items/:itemId',                   requireMinRole('warehouse_manager'), ctrl.validate(updatePOItemSchema), ctrl.updateItem);
router.delete('/:id/items/:itemId',                requireMinRole('warehouse_manager'), ctrl.deleteItem);
// FIX #6 — new route: update received_boxes on an item with validation
router.patch('/:id/items/:itemId/receive',         requireMinRole('warehouse_manager'), ctrl.validate(receiveItemSchema), ctrl.receiveItem);

module.exports = router;
