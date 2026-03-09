'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');
const { openingStockSchema, adjustStockSchema } = require('./validation');

router.use(authenticate);

router.get('/stock', ctrl.listStock);
router.get('/stock/:id', ctrl.getStockById);
router.post('/opening-stock', requireMinRole('warehouse_manager'), ctrl.validate(openingStockSchema), ctrl.createOpeningStock);
router.put('/adjust/:id', requireMinRole('warehouse_manager'), ctrl.validate(adjustStockSchema), ctrl.adjustStock);
router.delete('/stock/:id', ctrl.deleteStock);

module.exports = router;
