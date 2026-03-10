'use strict';

const express = require('express');
const router = express.Router();
const rackController = require('./rack.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

router.use(authenticate);

router.post('/', rackController.createRack);
router.get('/', rackController.getRacks);
router.post('/assign', rackController.assignProduct);
router.get('/product/:productId', rackController.getProductStorage);
router.get('/:id', rackController.getRackById);
router.put('/:id', rackController.updateRack);
router.delete('/:id', rackController.deleteRack);

module.exports = router;
