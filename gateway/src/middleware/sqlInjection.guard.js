'use strict';

/**
 * SQL injection detection middleware.
 * Blocks requests containing known SQL injection patterns.
 * This is a defense-in-depth layer — the primary defense is parameterised queries.
 */

// Common SQL injection signatures
const SQL_PATTERNS = [
  /(\b)(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION|HAVING|WAITFOR|BENCHMARK)(\b)/i,
  /(--|\/\*|\*\/|xp_|sp_)/i,
  /(\bOR\b\s+\d+=\d+|\bAND\b\s+\d+=\d+)/i,
  /('|"|;|--|\bOR\b\s*['"]?\s*\d+\s*=\s*\d+)/i,
  /(CHAR\s*\(\d+\)|NCHAR\s*\(\d+\))/i,
  /(CAST\s*\(|CONVERT\s*\()/i,
  /(\bSLEEP\b\s*\(|\bDELAY\b\s*')/i,        // Time-based blind injection
  /(LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)/i,
];

function containsSQLInjection(value) {
  if (typeof value !== 'string') return false;
  return SQL_PATTERNS.some((pattern) => pattern.test(value));
}

function scanObject(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const val of Object.values(obj)) {
    if (typeof val === 'string' && containsSQLInjection(val)) return true;
    if (typeof val === 'object' && scanObject(val)) return true;
  }
  return false;
}

function sqlInjectionGuard(req, res, next) {
  const suspicious =
    scanObject(req.body) ||
    scanObject(req.query) ||
    scanObject(req.params);

  if (suspicious) {
    const logger = require('./logger.middleware');
    logger.warn({
      event:  'sql_injection_attempt',
      ip:      req.ip,
      path:    req.path,
      method:  req.method,
      body:    process.env.NODE_ENV !== 'production' ? req.body : '[redacted]',
    });

    return res.status(400).json({
      success: false,
      error:   'Invalid input detected.',
    });
  }

  next();
}

module.exports = sqlInjectionGuard;
