const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');

router.use(authenticate);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', requireRole(['super_admin', 'admin', 'accountant']), controller.create);
router.put('/:id', requireRole(['super_admin', 'admin', 'accountant']), controller.update);
router.delete('/:id', requireRole(['super_admin', 'admin', 'accountant']), controller.remove);

module.exports = router;
