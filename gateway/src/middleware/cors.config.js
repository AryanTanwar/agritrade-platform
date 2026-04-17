'use strict';

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * CORS configuration
 * In production, only explicitly whitelisted origins are allowed.
 * Credentials are permitted so JWT cookies can flow from allowed origins.
 */
const corsConfig = {
  origin(origin, callback) {
    // Allow non-browser requests (server-to-server, Postman in dev)
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('Direct API access not allowed in production'), false);
      }
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log blocked origins for security monitoring
    const logger = require('../../../shared/logger');
    logger.warn({ event: 'cors_blocked', origin }, 'CORS blocked origin');

    return callback(new Error(`CORS policy: origin ${origin} not allowed`), false);
  },

  methods: (process.env.CORS_ALLOWED_METHODS || 'GET,POST,PUT,PATCH,DELETE').split(','),

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Idempotency-Key',
  ],

  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],

  credentials: true,   // Required for JWT httpOnly cookies
  maxAge:      86400,  // Preflight cache — 24 hours
};

module.exports = corsConfig;
