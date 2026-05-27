'use strict';

const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');

router.use(authenticate);

router.get('/', ctrl.getConfig);
router.put('/', ctrl.saveConfig);
router.delete('/', ctrl.resetConfig);

module.exports = router;
