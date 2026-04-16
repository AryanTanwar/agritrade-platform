'use strict';

const jwt = require('jsonwebtoken');
const { UnauthorizedError, ForbiddenError } = require('../error-handler');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER || 'agritrade';

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}

/**
 * Verifies a Bearer JWT and attaches the decoded payload to req.user.
 *
 * Payload shape:
 *   { id, role, mspId, phone, iat, exp, iss }
 *
 * Usage:
 *   router.get('/protected', authenticate, handler)
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next(new UnauthorizedError('Empty token'));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer:     JWT_ISSUER,
      algorithms: ['HS256'],
    });

    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid token'));
    }
    if (err.name === 'NotBeforeError') {
      return next(new UnauthorizedError('Token not yet active'));
    }
    next(err);
  }
}

/**
 * Role-based access guard. Must be placed after authenticate().
 *
 * @param {...string} roles - Allowed roles (e.g. 'farmer', 'buyer', 'logistics')
 *
 * Usage:
 *   router.post('/listings', authenticate, authorise('farmer'), handler)
 */
function authorise(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Role '${req.user.role}' is not permitted. Required: ${roles.join(' | ')}`
        )
      );
    }
    next();
  };
}

/**
 * Optional auth — populates req.user if token is present but does NOT reject
 * requests without a token. Useful for endpoints with mixed public/private data.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  try {
    req.user = jwt.verify(token, JWT_SECRET, {
      issuer:     JWT_ISSUER,
      algorithms: ['HS256'],
    });
  } catch {
    // Silently ignore invalid/expired tokens for optional auth
  }
  next();
}

module.exports = { authenticate, authorise, optionalAuth };
