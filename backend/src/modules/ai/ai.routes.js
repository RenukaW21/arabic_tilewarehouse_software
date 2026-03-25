const express = require('express');
const router = express.Router();
const { handleAIQuery } = require('./ai.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

router.post('/query', authenticate, handleAIQuery);

module.exports = router;