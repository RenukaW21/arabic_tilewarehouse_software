'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireRole } = require('../../middlewares/role.middleware');
const validation = require('./validation');
const createSchema = validation.createSchema;
const updateSchema = validation.updateSchema;

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message,
        details: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      },
    });
  }
  next();
};

router.use(authenticate);
router.use(requireRole(['super_admin', 'admin']));

router.get('/', ctrl.get);
router.get('/:id', ctrl.getById);
router.post('/', validate(createSchema), ctrl.create);
router.put('/:id', validate(updateSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
