'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../../../shared/db');
const {
  ValidationError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} = require('../../../../shared/error-handler');

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // eslint-disable-line no-unused-vars
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER || 'agritrade';

/**
 * Generate a signed JWT access token and an opaque UUID refresh token.
 * @param {object} user - DB row with id, role, msp_id, phone
 * @returns {{ accessToken: string, refreshToken: string }}
 */
function generateTokens(user) {
  const payload = {
    id: user.id,
    role: user.role,
    mspId: user.msp_id,
    phone: user.phone,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    issuer: JWT_ISSUER,
    algorithm: 'HS256',
  });

  const refreshToken = uuidv4(); // opaque token stored in DB
  return { accessToken, refreshToken };
}

/**
 * Register a new user (farmer, buyer, or logistics).
 * @param {object} data - Registration payload including role
 * @returns {object} Newly created user row (no password_hash)
 */
async function register(data) {
  // 1. Check phone uniqueness
  const existing = await db.query('SELECT id FROM users WHERE phone = $1', [data.phone]);
  if (existing.rows.length) throw new ConflictError('Phone number already registered');

  // 2. Hash password
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  // 3. Derive MSP ID from role
  let mspId;
  if (data.role === 'farmer') {
    mspId = 'FarmersMSP';
  } else if (data.role === 'logistics') {
    mspId = 'LogisticsMSP';
  } else {
    mspId = 'BuyersMSP';
  }

  // 4. Insert user record
  const result = await db.query(
    `INSERT INTO users
       (id, phone, email, name, role, msp_id, password_hash,
        district, state, pincode, business_name, gst_number, address,
        created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
     RETURNING id, phone, email, name, role, msp_id, created_at`,
    [
      uuidv4(),
      data.phone,
      data.email || null,
      data.name,
      data.role,
      mspId,
      passwordHash,
      data.district || null,
      data.state || null,
      data.pincode || null,
      data.businessName || null,
      data.gstNumber || null,
      data.address || null,
    ]
  );

  return result.rows[0];
}

/**
 * Authenticate a user with phone/email + password.
 * Returns tokens on success, or a tempToken if 2FA is required.
 *
 * @param {{ phone?: string, email?: string, password: string }} credentials
 * @returns {object}
 */
async function login({ phone, email, password }) {
  // Find user by phone or email
  const result = await db.query(
    'SELECT * FROM users WHERE phone = $1 OR (email = $2 AND $2 IS NOT NULL) LIMIT 1',
    [phone || null, email || null]
  );
  const user = result.rows[0];
  if (!user) throw new UnauthorizedError('Invalid credentials');

  // Verify password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new UnauthorizedError('Invalid credentials');

  // Check account status
  if (user.status !== 'active') throw new UnauthorizedError('Account is not active');

  // If 2FA is enabled, return a short-lived pre-2FA temp token
  if (user.totp_enabled) {
    const tempToken = jwt.sign(
      { id: user.id, type: 'pre2fa' },
      JWT_SECRET,
      { expiresIn: '5m', issuer: JWT_ISSUER }
    );
    return { requires2FA: true, tempToken };
  }

  const { accessToken, refreshToken } = generateTokens(user);

  // Persist refresh token as a session record
  await db.query(
    `INSERT INTO user_sessions (id, user_id, refresh_token, expires_at, created_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', NOW())`,
    [uuidv4(), user.id, refreshToken]
  );

  return {
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    accessToken,
    refreshToken,
  };
}

/**
 * Exchange a valid refresh token for a new token pair (rotation).
 * @param {string} token - The opaque refresh token
 * @returns {{ accessToken: string, refreshToken: string }}
 */
async function refreshToken(token) {
  if (!token) throw new ValidationError('Refresh token required');

  const session = await db.query(
    `SELECT * FROM user_sessions
     WHERE refresh_token = $1
       AND expires_at > NOW()
       AND revoked = false`,
    [token]
  );
  if (!session.rows.length) throw new UnauthorizedError('Invalid or expired refresh token');

  const userResult = await db.query('SELECT * FROM users WHERE id = $1', [session.rows[0].user_id]);
  const user = userResult.rows[0];
  if (!user || user.status !== 'active') throw new UnauthorizedError('Account not active');

  // Rotate: revoke old token, issue new pair
  const { accessToken, refreshToken: newRefresh } = generateTokens(user);

  await db.withTransaction(async (client) => {
    await client.query(
      'UPDATE user_sessions SET revoked = true WHERE refresh_token = $1',
      [token]
    );
    await client.query(
      `INSERT INTO user_sessions (id, user_id, refresh_token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', NOW())`,
      [uuidv4(), user.id, newRefresh]
    );
  });

  return { accessToken, refreshToken: newRefresh };
}

/**
 * Revoke the given refresh token for the specified user.
 * @param {string} userId
 * @param {string|undefined} token - The refresh token to revoke (optional)
 */
async function logout(userId, token) {
  if (token) {
    await db.query(
      'UPDATE user_sessions SET revoked = true WHERE user_id = $1 AND refresh_token = $2',
      [userId, token]
    );
  }
}

/**
 * Change a user's password and revoke all existing sessions.
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 */
async function changePassword(userId, currentPassword, newPassword) {
  const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];
  if (!user) throw new NotFoundError('User not found');

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) throw new UnauthorizedError('Current password is incorrect');

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [newHash, userId]
  );

  // Revoke all active sessions so other devices are signed out
  await db.query('UPDATE user_sessions SET revoked = true WHERE user_id = $1', [userId]);
}

module.exports = { register, login, refreshToken, logout, changePassword };
