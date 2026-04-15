'use strict';

const crypto = require('crypto');

const ALGORITHM  = 'aes-256-gcm';
const IV_LENGTH  = 16;    // 128-bit IV
const TAG_LENGTH = 16;    // 128-bit auth tag
const KEY_LENGTH = 32;    // 256-bit key

// Derive a Buffer key from the hex env var — validated at startup
function getKey() {
  const keyHex = process.env.AES_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('AES_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a single base64 string: IV (16B) + ciphertext + auth tag (16B)
 *
 * @param {string} plaintext
 * @returns {string} base64-encoded encrypted payload
 */
function encrypt(plaintext) {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encrypt() requires a string input');
  }

  const key  = getKey();
  const iv   = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Layout: [IV (16)] [tag (16)] [ciphertext (n)]
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a payload produced by encrypt().
 *
 * @param {string} encryptedBase64
 * @returns {string} original plaintext
 */
function decrypt(encryptedBase64) {
  const key  = getKey();
  const buf  = Buffer.from(encryptedBase64, 'base64');

  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted payload length');
  }

  const iv         = buf.subarray(0, IV_LENGTH);
  const tag        = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Hash a value using SHA-256 (for deterministic lookup of encrypted fields).
 * Never use this for passwords — use bcrypt instead.
 *
 * @param {string} value
 * @returns {string} hex digest
 */
function sha256Hash(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Constant-time string comparison — prevents timing attacks.
 */
function safeCompare(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generate a cryptographically secure random token.
 * @param {number} bytes — default 32
 * @returns {string} hex string
 */
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = { encrypt, decrypt, sha256Hash, safeCompare, randomToken };
