'use strict';

const express = require('express');
const router = express.Router();
const customerController = require('./customer.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const csvUpload = require("../../middlewares/csvUpload.middleware");

router.use(authenticate);

router.post('/import/csv', csvUpload.single("file"), customerController.importCsv);

router.post('/', customerController.createCustomer);
router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
