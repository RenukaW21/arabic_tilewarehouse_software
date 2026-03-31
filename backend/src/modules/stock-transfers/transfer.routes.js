'use strict';

const express = require('express');
const router = express.Router();
const transferController = require('./transfer.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { attachWarehouseScope } = require('../../middlewares/warehouse-scope.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');

router.use(authenticate);
router.use(attachWarehouseScope);

router.post('/', transferController.createTransfer);
router.get('/', transferController.getTransfers);
router.get('/by-product/:productId', transferController.getTransfersByProduct);
router.get('/:id', transferController.getTransferById);
router.put('/:id', transferController.updateTransfer);
router.delete('/:id', transferController.deleteTransfer);

// Two-step transfer lifecycle
router.post('/:id/confirm', requireMinRole('warehouse_manager'), transferController.confirmTransfer);
router.post('/:id/receive', requireMinRole('warehouse_manager'), transferController.receiveTransfer);

module.exports = router;
