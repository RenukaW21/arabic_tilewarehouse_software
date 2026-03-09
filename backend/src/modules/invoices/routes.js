'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

router.use(authenticate);
router.get('/',            ctrl.getAll);
router.get('/:id',         ctrl.getById);
router.post('/',           requireRole(['super_admin','admin','accountant']), ctrl.createFromSO);
router.put('/:id',         requireRole(['super_admin','admin','accountant']), ctrl.update);
router.delete('/:id',      requireRole(['super_admin','admin','accountant']), ctrl.remove);
router.post('/:id/issue',  requireRole(['super_admin','admin','accountant']), ctrl.issueInvoice);
router.patch('/:id/payment', requireRole(['super_admin','admin','accountant']), ctrl.updatePaymentStatus);
module.exports = router;
