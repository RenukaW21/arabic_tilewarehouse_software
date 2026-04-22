'use strict';
const logger = require('../utils/logger');

/**
 * Build a flat, consistent error response body.
 */
const errBody = (code, message, suggestion = null, extra = {}) => ({
  success: false,
  code,
  message,
  ...(suggestion ? { suggestion } : {}),
  ...extra,
});

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
    const msg = err.details?.[0]?.message || err.message;
    return res.status(422).json({
      ...errBody('VALIDATION_ERROR', msg, 'Check all required fields and correct the highlighted errors.'),
      details: err.details?.map((d) => ({ field: d.path.join('.'), message: d.message })),
    });
  }

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json(
      errBody('DUPLICATE_ENTRY', 'A record with this value already exists.', 'Use a different value or edit the existing record.')
    );
  }

  // MySQL foreign key constraint
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json(
      errBody('FK_CONSTRAINT', 'This record is referenced by other data and cannot be modified.', 'Remove linked records first before making this change.')
    );
  }

  // MySQL / protocol packet issues
  if (
    err.code === 'ER_MALFORMED_PACKET' ||
    err.code === 'PROTOCOL_PACKETS_OUT_OF_ORDER' ||
    /Malformed communication packet/i.test(err.message || '')
  ) {
    return res.status(500).json(
      errBody(
        'DATABASE_REQUEST_FAILED',
        'We could not save your changes because the server could not process the warehouse request.',
        'Please try again. If it happens again, contact support.'
      )
    );
  }

  // Custom AppError
  if (err.statusCode) {
    return res.status(err.statusCode).json(
      errBody(err.code || 'APP_ERROR', err.message, err.suggestion || null)
    );
  }

  // Generic 500
  res.status(500).json(
    errBody('INTERNAL_ERROR', process.env.NODE_ENV === 'production' ? 'An unexpected error occurred. Please try again.' : err.message, 'If the problem persists, contact support.')
  );
};

/**
 * 404 handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json(
    errBody('NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found.`, 'Check the URL and try again.')
  );
};

/**
 * Custom error class for application errors.
 * @param {string} message   Human-readable message shown to the user.
 * @param {number} statusCode HTTP status code (default 400).
 * @param {string} code      Machine-readable error code.
 * @param {string|null} suggestion  What the user should do to fix the problem.
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'APP_ERROR', suggestion = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.suggestion = suggestion;
  }
}

module.exports = { errorHandler, notFoundHandler, AppError };
