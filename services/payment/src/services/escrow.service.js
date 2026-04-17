'use strict';

const { v4: uuidv4 }    = require('uuid');
const db                = require('../../../shared/db');
const fabricClient      = require('../../../shared/fabric-client');
const { NotFoundError, ForbiddenError, ValidationError } = require('../../../shared/error-handler');
const logger            = require('../../../shared/logger');

const FABRIC_CHANNEL    = process.env.FABRIC_CHANNEL_NAME || 'agritrade-channel';
const FABRIC_CHAINCODE  = 'escrow';

async function _getEscrow(escrowId) {
  const result = await db.query('SELECT * FROM escrows WHERE id = $1', [escrowId]);
  if (!result.rows.length) throw new NotFoundError(`Escrow ${escrowId} not found`);
  return result.rows[0];
}

/**
 * Create an escrow hold after a verified Razorpay payment.
 */
async function createEscrow(user, data) {
  const { orderId, farmerId, farmerMsp, amount, currency = 'INR', paymentRef, paymentProofHash, expiresAt } = data;

  if (!orderId)         throw new ValidationError('orderId is required');
  if (!farmerId)        throw new ValidationError('farmerId is required');
  if (!amount || amount <= 0) throw new ValidationError('amount must be positive');
  if (!paymentRef)      throw new ValidationError('paymentRef is required');

  const id = uuidv4();

  const ccInput = {
    id, orderId, farmerId, farmerMsp: farmerMsp || 'FarmersMSP',
    amount, currency, paymentRef,
    paymentProofHash: paymentProofHash || '',
    expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  let txID = '';
  try {
    const raw = await fabricClient.submitTransaction(
      FABRIC_CHANNEL, FABRIC_CHAINCODE, 'CreateEscrow', JSON.stringify(ccInput)
    );
    txID = JSON.parse(raw.toString()).txID || '';
  } catch (err) {
    logger.error({ event: 'fabric_create_escrow_failed', error: err.message });
    throw err;
  }

  const result = await db.query(
    `INSERT INTO escrows
       (id, order_id, buyer_id, buyer_msp, farmer_id, farmer_msp,
        amount, currency, payment_ref, payment_proof_hash, status, hold_tx_id, expires_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'held',$11,$12,NOW(),NOW())
     RETURNING *`,
    [
      id, orderId, user.id, user.mspId || 'BuyersMSP',
      farmerId, farmerMsp || 'FarmersMSP',
      amount, currency, paymentRef, paymentProofHash || null,
      txID, data.expiresAt || null,
    ]
  );
  return result.rows[0];
}

async function releaseEscrow(user, escrowId) {
  const escrow = await _getEscrow(escrowId);
  if (escrow.farmer_id !== user.id) throw new ForbiddenError('Only the farmer can release this escrow');
  if (escrow.status !== 'held') throw new ValidationError(`Escrow is not in held state (current: ${escrow.status})`);

  try {
    await fabricClient.submitTransaction(FABRIC_CHANNEL, FABRIC_CHAINCODE, 'ReleaseEscrow', escrowId);
  } catch (err) {
    logger.error({ event: 'fabric_release_escrow_failed', escrowId, error: err.message });
    throw err;
  }

  const result = await db.query(
    "UPDATE escrows SET status = 'released', farmer_release_amt = amount, released_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
    [escrowId]
  );
  return result.rows[0];
}

async function refundEscrow(user, escrowId) {
  const escrow = await _getEscrow(escrowId);
  if (escrow.buyer_id !== user.id) throw new ForbiddenError('Only the buyer can refund this escrow');
  if (escrow.status !== 'held') throw new ValidationError(`Escrow is not in held state (current: ${escrow.status})`);

  try {
    await fabricClient.submitTransaction(FABRIC_CHANNEL, FABRIC_CHAINCODE, 'RefundEscrow', escrowId);
  } catch (err) {
    logger.error({ event: 'fabric_refund_escrow_failed', escrowId, error: err.message });
    throw err;
  }

  const result = await db.query(
    "UPDATE escrows SET status = 'refunded', buyer_refund_amt = amount, refunded_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
    [escrowId]
  );
  return result.rows[0];
}

async function raiseDispute(user, escrowId, reason) {
  if (!reason || !reason.trim()) throw new ValidationError('Dispute reason is required');

  const escrow = await _getEscrow(escrowId);
  if (escrow.buyer_id !== user.id && escrow.farmer_id !== user.id) {
    throw new ForbiddenError('You are not a party to this escrow');
  }
  if (escrow.status !== 'held') throw new ValidationError('Can only dispute an escrow in held state');

  try {
    await fabricClient.submitTransaction(FABRIC_CHANNEL, FABRIC_CHAINCODE, 'RaiseDispute', escrowId, reason);
  } catch (err) {
    logger.error({ event: 'fabric_raise_dispute_failed', escrowId, error: err.message });
    throw err;
  }

  const result = await db.query(
    "UPDATE escrows SET status = 'disputed', dispute_reason = $1, disputed_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *",
    [reason, escrowId]
  );
  return result.rows[0];
}

async function resolveDispute(user, escrowId, resolution) {
  const { outcome, farmerReleaseAmt, buyerRefundAmt } = resolution;

  if (!['FARMER_WINS', 'BUYER_WINS', 'SPLIT'].includes(outcome)) {
    throw new ValidationError('outcome must be FARMER_WINS, BUYER_WINS, or SPLIT');
  }

  const escrow = await _getEscrow(escrowId);
  if (escrow.status !== 'disputed') throw new ValidationError('Escrow must be in disputed state');

  const total = (farmerReleaseAmt || 0) + (buyerRefundAmt || 0);
  if (total > escrow.amount + 0.001) {
    throw new ValidationError(`Split amounts (${total}) exceed escrow total (${escrow.amount})`);
  }

  const ccInput = JSON.stringify({ outcome, farmerReleaseAmt: farmerReleaseAmt || 0, buyerRefundAmt: buyerRefundAmt || 0 });
  try {
    await fabricClient.submitTransaction(FABRIC_CHANNEL, FABRIC_CHAINCODE, 'ResolveDispute', escrowId, ccInput);
  } catch (err) {
    logger.error({ event: 'fabric_resolve_dispute_failed', escrowId, error: err.message });
    throw err;
  }

  const newStatus = outcome === 'BUYER_WINS' ? 'refunded' : 'released';
  const result    = await db.query(
    `UPDATE escrows SET
       status = $1, dispute_outcome = $2,
       farmer_release_amt = $3, buyer_refund_amt = $4,
       resolved_at = NOW(), updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [newStatus, outcome, farmerReleaseAmt || 0, buyerRefundAmt || 0, escrowId]
  );
  return result.rows[0];
}

async function getEscrow(user, escrowId) {
  const escrow = await _getEscrow(escrowId);
  if (escrow.buyer_id !== user.id && escrow.farmer_id !== user.id) {
    throw new ForbiddenError('Access denied');
  }
  return escrow;
}

module.exports = { createEscrow, releaseEscrow, refundEscrow, raiseDispute, resolveDispute, getEscrow };
