'use strict';

const xss = require('xss');

/**
 * Recursively sanitize all string values in an object.
 * Strips HTML tags and dangerous characters from user input.
 */
function sanitizeValue(value) {
  if (typeof value === 'string') {
    return xss(value, {
      whiteList:         {},   // No HTML tags allowed in API inputs
      stripIgnoreTag:    true,
      stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
    });
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
}

function sanitizeObject(obj) {
  const clean = {};
  for (const key of Object.keys(obj)) {
    // Sanitize the key itself to prevent prototype pollution
    const safeKey = key.replace(/[<>"'/\\]/g, '');
    if (!['__proto__', 'constructor', 'prototype'].includes(safeKey)) {
      clean[safeKey] = sanitizeValue(obj[key]);
    }
  }
  return clean;
}

/**
 * Express middleware — sanitizes req.body, req.query, req.params
 */
function xssClean(req, res, next) {
  if (req.body)   req.body   = sanitizeObject(req.body);
  if (req.query)  req.query  = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
}

module.exports = xssClean;
