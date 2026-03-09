'use strict';
const logger = require('../utils/logger');

/**
 * Centralized error handler — must be registered LAST in Express.
 */
const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error('Unhandled error', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    tenantId: req.tenantId,
    userId: req.user?.id,
  });

  // Joi validation errors
  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.details?.[0]?.message || err.message,
        details: err.details?.map((d) => ({ field: d.path.join('.'), message: d.message })),
      },
    });
  }

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_ENTRY', message: 'A record with this value already exists' },
    });
  }

  // MySQL foreign key constraint
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      error: { code: 'FK_CONSTRAINT', message: 'Related record not found or record is in use' },
    });
  }

  // Custom AppError
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code || 'APP_ERROR', message: err.message },
    });
  }

  // Generic 500
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
  });
};

/**
 * 404 handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  });
};

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = { errorHandler, notFoundHandler, AppError };
