'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const BCRYPT_ROUNDS = 12; // ~300ms on modern hardware — strong enough, not too slow

/**
 * Hash a password using bcrypt.
 * @param {string} password
 * @returns {Promise<string>} bcrypt hash
 */
async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new TypeError('hashPassword() requires a non-empty string');
  }
  if (password.length > 72) {
    // bcrypt silently truncates at 72 bytes — pre-hash for long passwords
    password = crypto.createHash('sha512').update(password).digest('hex');
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 * Uses bcrypt.compare which is timing-safe by design.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  if (password.length > 72) {
    password = crypto.createHash('sha512').update(password).digest('hex');
  }
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically secure random OTP.
 * @param {number} digits — default 6
 * @returns {string} zero-padded digit string
 */
function generateOTP(digits = 6) {
  const max = Math.pow(10, digits);
  const otp = crypto.randomInt(0, max);
  return String(otp).padStart(digits, '0');
}

/**
 * Generate a URL-safe random token (for email verification, password reset).
 * @param {number} bytes — default 32
 * @returns {string} hex string
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * HMAC-SHA256 — used to sign webhook payloads, idempotency keys, etc.
 * @param {string} data
 * @param {string} secret
 * @returns {string} hex HMAC
 */
function hmacSign(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify an HMAC signature in constant time.
 * @param {string} data
 * @param {string} secret
 * @param {string} signature — hex string to compare
 * @returns {boolean}
 */
function hmacVerify(data, secret, signature) {
  const expected = hmacSign(data, secret);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Derive a key from a passphrase using PBKDF2.
 * Useful for encrypting exported data with a user-supplied passphrase.
 * @param {string} passphrase
 * @param {Buffer} salt — use crypto.randomBytes(32) and store alongside ciphertext
 * @returns {Promise<Buffer>} 32-byte derived key
 */
function deriveKey(passphrase, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(passphrase, salt, 310_000, 32, 'sha256', (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateOTP,
  generateToken,
  hmacSign,
  hmacVerify,
  deriveKey,
};
