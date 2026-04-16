'use strict';

const speakeasy = require('speakeasy');
const qrcode    = require('qrcode');
const bcrypt    = require('bcrypt');
const db        = require('../../../shared/db');
const { ValidationError, UnauthorizedError } = require('../../../shared/error-handler');

// AES helper — gracefully degrade if module is absent in dev
let encrypt, decrypt;
try {
  ({ encrypt, decrypt } = require('../../../shared/crypto/aes256'));
} catch {
  encrypt = (v) => v;
  decrypt = (v) => v;
}

const TOTP_ISSUER = 'AgriTrade';

/**
 * Generate a new TOTP secret for the user.
 * Secret is stored encrypted; 2FA is NOT yet enabled until verify() succeeds.
 */
async function setup(userId) {
  const secret = speakeasy.generateSecret({
    length: 32,
    name:   `${TOTP_ISSUER}:${userId}`,
    issuer: TOTP_ISSUER,
  });

  const encryptedSecret = encrypt(secret.base32);

  await db.query(
    'UPDATE users SET totp_secret = $1, totp_enabled = false, updated_at = NOW() WHERE id = $2',
    [encryptedSecret, userId]
  );

  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
  return { secret: secret.base32, qrCodeUrl };
}

/**
 * Verify the TOTP token and enable 2FA.
 */
async function verify(userId, token) {
  const result = await db.query('SELECT totp_secret FROM users WHERE id = $1', [userId]);
  const user   = result.rows[0];
  if (!user || !user.totp_secret) throw new ValidationError('2FA setup not initiated');

  const secret = decrypt(user.totp_secret);
  const valid  = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window:   1,  // allow 30-second clock drift
  });

  if (!valid) throw new ValidationError('Invalid 2FA token');

  await db.query(
    'UPDATE users SET totp_enabled = true, updated_at = NOW() WHERE id = $1',
    [userId]
  );
  return true;
}

/**
 * Disable 2FA after password confirmation.
 */
async function disable(userId, password) {
  const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const user   = result.rows[0];
  if (!user) throw new UnauthorizedError('User not found');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new UnauthorizedError('Password is incorrect');

  await db.query(
    'UPDATE users SET totp_enabled = false, totp_secret = NULL, updated_at = NOW() WHERE id = $1',
    [userId]
  );
}

/**
 * Verify token during the login 2FA step (does not modify state).
 */
async function verifyForLogin(userId, token) {
  const result = await db.query(
    'SELECT totp_secret, totp_enabled FROM users WHERE id = $1',
    [userId]
  );
  const user = result.rows[0];
  if (!user || !user.totp_enabled || !user.totp_secret) {
    throw new ValidationError('2FA not enabled');
  }

  const secret = decrypt(user.totp_secret);
  const valid  = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
  if (!valid) throw new UnauthorizedError('Invalid 2FA token');
  return true;
}

module.exports = { setup, verify, disable, verifyForLogin };
