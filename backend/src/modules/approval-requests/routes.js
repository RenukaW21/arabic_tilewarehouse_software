'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const { createSchema, approveRejectSchema } = require('./validation');

router.use(authenticate);

// All authenticated users can list (service filters to own if not admin)
router.get('/',        ctrl.list);
router.get('/stats',   requireRole(['super_admin', 'admin']), ctrl.stats);
router.get('/:id',     ctrl.getById);

// Any operational role can submit a request
router.post('/', ctrl.validate(createSchema), ctrl.create);

// Only admin/super_admin can approve or reject
router.post('/:id/approve', requireRole(['super_admin', 'admin']), ctrl.validate(approveRejectSchema), ctrl.approve);
router.post('/:id/reject',  requireRole(['super_admin', 'admin']), ctrl.validate(approveRejectSchema), ctrl.reject);

module.exports = router;
