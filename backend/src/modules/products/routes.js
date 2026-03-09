'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole, requireMinRole } = require('../../middlewares/role.middleware');
const { validate, productSchema, updateProductSchema } = require('./validation');
const upload = require('../../middlewares/upload.middleware');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', requireMinRole('admin'),upload.single('image'), validate(productSchema), ctrl.create);
router.put('/:id', requireMinRole('admin'), upload.single('image'), validate(updateProductSchema), ctrl.update);
router.delete('/:id', requireMinRole('admin'), ctrl.remove);

module.exports = router;
