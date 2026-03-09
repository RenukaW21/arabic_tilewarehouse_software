'use strict';
const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authLimiter } = require('../../middlewares/rateLimiter.middleware');
const { validate, loginSchema, registerTenantSchema, refreshTokenSchema, changePasswordSchema } = require('./validation');

// Public routes
router.post('/login',   authLimiter, validate(loginSchema),          ctrl.login);
router.post('/refresh', authLimiter, validate(refreshTokenSchema),   ctrl.refresh);
router.post('/logout',               validate(refreshTokenSchema),   ctrl.logout);
router.post('/register',             validate(registerTenantSchema), ctrl.register);

// Protected routes
router.get('/profile',         authenticate, ctrl.getProfile);
router.put('/change-password', authenticate, validate(changePasswordSchema), ctrl.changePassword);

module.exports = router;
