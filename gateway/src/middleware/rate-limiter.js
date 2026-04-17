'use strict';

const rateLimit  = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const redis      = require('../shared/redis-client');

/**
 * Factory that creates a rate limiter backed by Redis.
 * Using Redis ensures limits are enforced across all gateway instances.
 */
function createLimiter({ windowMs, max, keyPrefix, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,   // Return RateLimit-* headers (RFC 6585)
    legacyHeaders:   false,
    keyGenerator(req) {
      // Use authenticated user ID if available, else IP
      return req.user?.id
        ? `${keyPrefix}:user:${req.user.id}`
        : `${keyPrefix}:ip:${req.ip}`;
    },
    store: new RedisStore({
      sendCommand: (...args) => redis.sendCommand(args),
      prefix: `rl:${keyPrefix}:`,
    }),
    handler(req, res) {
      const logger = require('../../../shared/logger');
      logger.warn({ event: 'rate_limit_exceeded', ip: req.ip, path: req.path });
      res.status(429).json({
        success: false,
        error:   message || 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
    skip(req) {
      // Never rate-limit health checks
      return req.path === '/health' || req.path === '/metrics';
    },
  });
}

// ─── Tiered limiters ──────────────────────────────────────────────────────────

/** General API: 100 requests per minute */
const globalLimiter = createLimiter({
  windowMs:  60_000,
  max:       100,
  keyPrefix: 'global',
  message:   'Too many requests. Please slow down.',
});

/** Auth endpoints: 10 attempts per 15 minutes (brute-force protection) */
const authLimiter = createLimiter({
  windowMs:  15 * 60_000,
  max:       10,
  keyPrefix: 'auth',
  message:   'Too many authentication attempts. Please wait 15 minutes.',
});

/** Payment endpoints: 20 per minute (fraud throttle) */
const paymentLimiter = createLimiter({
  windowMs:  60_000,
  max:       20,
  keyPrefix: 'payment',
  message:   'Too many payment requests.',
});

/** OTP / SMS: 5 per hour per number */
const otpLimiter = createLimiter({
  windowMs:  60 * 60_000,
  max:       5,
  keyPrefix: 'otp',
  message:   'Too many OTP requests. Please wait an hour.',
});

/** File upload: 10 per minute */
const uploadLimiter = createLimiter({
  windowMs:  60_000,
  max:       10,
  keyPrefix: 'upload',
  message:   'Too many upload requests.',
});

module.exports = {
  globalLimiter,
  authLimiter,
  paymentLimiter,
  otpLimiter,
  uploadLimiter,
};
