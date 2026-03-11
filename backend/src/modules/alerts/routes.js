'use strict';

const express = require('express');
const controller = require('./controllers');

const router = express.Router();

/**
 * GET LOW STOCK ALERTS
 */
router.get('/low-stock', controller.getLowStockAlerts);

/**
 * UPDATE ALERT STATUS
 */
router.patch('/:id', controller.updateAlertStatus);

module.exports = router;