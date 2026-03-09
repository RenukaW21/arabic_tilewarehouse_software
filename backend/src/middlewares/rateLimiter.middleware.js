'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * General API rate limiter
 * Logged-in users (req.user present) ko skip karega
 */
const apiLimiter = rateLimit({
  windowMs: env.security.rateLimitWindowMs, // rate limit window
  max: env.security.rateLimitMax, // max requests per window

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.'
    }
  },

  // tenant + IP based rate limit key
  keyGenerator: (req) => {
    return `${req.ip}_${req.tenantId || 'anon'}`;
  },

  /**
   * IMPORTANT:
   * Agar user authenticated hai (req.user exist karta hai)
   * to rate limiter skip ho jayega
   */
  skip: (req) => {
    return !!req.user;
  }
});


/**
 * Strict limiter for auth endpoints
 * (login brute force attacks prevent karne ke liye)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts allowed

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again in 15 minutes.'
    }
  }
});

module.exports = {
  apiLimiter,
  authLimiter
};