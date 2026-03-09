'use strict';

const express = require('express');
const router = express.Router();
const transferController = require('./transfer.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');

router.use(authenticate);

router.post('/', transferController.createTransfer);
router.get('/', transferController.getTransfers);
router.get('/:id', transferController.getTransferById);
router.put('/:id', transferController.updateTransfer);
router.delete('/:id', transferController.deleteTransfer);
// Execute transfer (dispatch) — moves stock via ledger; transaction-safe
router.post('/:id/execute', requireMinRole('warehouse_manager'), transferController.executeTransfer);

module.exports = router;
