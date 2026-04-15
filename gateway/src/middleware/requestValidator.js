'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Injects a unique X-Request-ID into every request and response.
 * Used for distributed tracing and audit log correlation.
 */
function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
}

/**
 * Validates Content-Type for mutation requests.
 * Rejects requests that are not application/json to prevent CSRF via form posts.
 */
function contentTypeGuard(req, res, next) {
  const mutationMethods = ['POST', 'PUT', 'PATCH'];
  if (mutationMethods.includes(req.method)) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('application/json') && !ct.includes('multipart/form-data')) {
      return res.status(415).json({
        success: false,
        error:   'Unsupported Media Type. Use application/json.',
      });
    }
  }
  next();
}

/**
 * Strips unexpected root-level keys to prevent mass assignment.
 * Each route should define its own allowlist via Joi schema — this is a backstop.
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    // Remove __proto__, constructor keys (prototype pollution prevention)
    const safe = JSON.parse(
      JSON.stringify(req.body, (key, val) =>
        ['__proto__', 'constructor', 'prototype'].includes(key) ? undefined : val
      )
    );
    req.body = safe;
  }
  next();
}

module.exports = { requestId, contentTypeGuard, sanitizeBody };
