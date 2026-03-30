'use strict';

const express = require('express');
const router = express.Router();
const customerController = require('./customer.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const csvUpload = require("../../middlewares/csvUpload.middleware");

router.use(authenticate);

const ADMIN_ONLY    = requireRole(['super_admin', 'admin']);
const ADMIN_SALES   = requireRole(['super_admin', 'admin', 'sales']);

router.post('/import/csv', ADMIN_SALES, csvUpload.single("file"), customerController.importCsv);

router.get('/',    customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);
router.post('/',   ADMIN_SALES,  customerController.createCustomer);
router.put('/:id', ADMIN_SALES,  customerController.updateCustomer);
router.delete('/:id', ADMIN_ONLY, customerController.deleteCustomer);

module.exports = router;
