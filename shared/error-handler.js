'use strict';

const logger = require('./logger');

/**
 * Custom application error class.
 * Distinguishes operational errors (expected, safe to expose) from
 * programmer errors (unexpected, hide details from client).
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.statusCode    = statusCode;
    this.code          = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Known error types ────────────────────────────────────────────────────────
class ValidationError    extends AppError { constructor(msg) { super(msg, 400, 'VALIDATION_ERROR'); } }
class UnauthorizedError  extends AppError { constructor(msg = 'Unauthorized') { super(msg, 401, 'UNAUTHORIZED'); } }
class ForbiddenError     extends AppError { constructor(msg = 'Forbidden')    { super(msg, 403, 'FORBIDDEN'); } }
class NotFoundError      extends AppError { constructor(msg = 'Not found')    { super(msg, 404, 'NOT_FOUND'); } }
class ConflictError      extends AppError { constructor(msg)                  { super(msg, 409, 'CONFLICT'); } }
class RateLimitError     extends AppError { constructor(msg)                  { super(msg, 429, 'RATE_LIMITED'); } }
class BlockchainError    extends AppError { constructor(msg)                  { super(msg, 502, 'BLOCKCHAIN_ERROR'); } }

/**
 * Express global error-handling middleware (4-arg signature required by Express).
 * Must be registered AFTER all routes.
 */
// eslint-disable-next-line no-unused-vars
function globalErrorHandler(err, req, res, next) {
  // Log every error with full context
  logger.error({
    event:      'unhandled_error',
    requestId:  req.id,
    userId:     req.user?.id,
    path:       req.path,
    method:     req.method,
    statusCode: err.statusCode || 500,
    code:       err.code,
    message:    err.message,
    stack:      err.stack,
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (err.isOperational) {
    // Safe to tell the client what went wrong
    return res.status(err.statusCode).json({
      success: false,
      code:    err.code,
      error:   err.message,
      requestId: req.id,
    });
  }

  // Programmer / unknown error — never reveal internals in production
  return res.status(500).json({
    success:   false,
    code:      'INTERNAL_ERROR',
    error:     isProd ? 'An unexpected error occurred.' : err.message,
    requestId: req.id,
  });
}

/**
 * 404 handler — register after all routes, before globalErrorHandler.
 */
function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BlockchainError,
  globalErrorHandler,
  notFoundHandler,
};
