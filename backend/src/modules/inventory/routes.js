'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { attachWarehouseScope } = require('../../middlewares/warehouse-scope.middleware');
const { requireMinRole } = require('../../middlewares/role.middleware');
const { openingStockSchema, adjustStockSchema } = require('./validation');

router.use(authenticate);
router.use(attachWarehouseScope);

router.get('/stock', ctrl.listStock);
router.get('/stock/:id', ctrl.getStockById);
router.post('/opening-stock', requireMinRole('warehouse_manager'), ctrl.validate(openingStockSchema), ctrl.createOpeningStock);
router.put('/adjust/:id', requireMinRole('warehouse_manager'), ctrl.validate(adjustStockSchema), ctrl.adjustStock);
// Rack assignment: move unassigned GRN stock into a physical rack (Step 3 of inbound flow)
router.post('/assign-rack', requireMinRole('warehouse_manager'), ctrl.assignToRack);
router.delete('/stock/:id', ctrl.deleteStock);

module.exports = router;
