'use strict';

const db = require('../../../../shared/db');
const { NotFoundError, ValidationError } = require('../../../../shared/error-handler');

const SAFE_COLUMNS = [
  'id', 'name', 'phone', 'email', 'role', 'msp_id',
  'district', 'state', 'pincode', 'business_name', 'gst_number',
  'address', 'kyc_status', 'totp_enabled', 'status',
  'created_at', 'updated_at',
].join(', ');

async function getById(userId) {
  const result = await db.query(`SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1`, [userId]);
  if (!result.rows.length) throw new NotFoundError('User not found');
  return result.rows[0];
}

async function update(userId, data) {
  // Explicit whitelist of updatable fields
  const fieldMap = {
    name:         'name',
    email:        'email',
    address:      'address',
    district:     'district',
    state:        'state',
    pincode:      'pincode',
    businessName: 'business_name',
  };

  const setClauses = [];
  const values     = [];
  let   idx        = 1;

  for (const [bodyKey, col] of Object.entries(fieldMap)) {
    if (data[bodyKey] !== undefined) {
      setClauses.push(`${col} = $${idx++}`);
      values.push(data[bodyKey]);
    }
  }

  if (!setClauses.length) throw new ValidationError('No valid fields provided for update');

  setClauses.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await db.query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING ${SAFE_COLUMNS}`,
    values
  );
  if (!result.rows.length) throw new NotFoundError('User not found');
  return result.rows[0];
}

async function submitKYC(userId, data) {
  const result = await db.query(
    `INSERT INTO user_kyc
       (id, user_id, document_type, document_hash, aadhaar_last4, pan_number, status, submitted_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'pending', NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       document_type = EXCLUDED.document_type,
       document_hash = EXCLUDED.document_hash,
       aadhaar_last4 = EXCLUDED.aadhaar_last4,
       pan_number    = EXCLUDED.pan_number,
       status        = 'pending',
       submitted_at  = NOW()
     RETURNING *`,
    [
      userId,
      data.documentType,
      data.documentHash,
      data.aadhaarLast4 || null,
      data.panNumber    || null,
    ]
  );

  await db.query(
    "UPDATE users SET kyc_status = 'pending', updated_at = NOW() WHERE id = $1",
    [userId]
  );

  return result.rows[0];
}

async function getKYCStatus(userId) {
  const result = await db.query('SELECT * FROM user_kyc WHERE user_id = $1', [userId]);
  return result.rows[0] || { status: 'not_submitted' };
}

module.exports = { getById, update, submitKYC, getKYCStatus };
