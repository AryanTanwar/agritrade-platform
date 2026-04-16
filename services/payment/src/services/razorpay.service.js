'use strict';

const crypto     = require('crypto');
const Razorpay   = require('razorpay');
const { v4: uuidv4 } = require('uuid');
const { ValidationError } = require('../../../shared/error-handler');
const logger     = require('../../../shared/logger');

let _client;
function getRazorpay() {
  if (!_client) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required');
    }
    _client = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _client;
}

/**
 * Create a Razorpay order.
 *
 * @param {Object} data  { orderId, amount (INR), currency? }
 * @returns Razorpay order object
 */
async function createOrder({ orderId, amount, currency = 'INR' }) {
  if (!orderId) throw new ValidationError('orderId is required');
  if (!amount || amount <= 0) throw new ValidationError('amount must be positive');

  const rzpOrder = await getRazorpay().orders.create({
    amount:          Math.round(amount * 100), // Razorpay uses paise
    currency,
    receipt:         orderId,
    payment_capture: 1,
    notes:           { agritradeOrderId: orderId },
  });

  logger.info({ event: 'razorpay_order_created', rzpOrderId: rzpOrder.id, orderId });
  return rzpOrder;
}

/**
 * Verify Razorpay payment signature (HMAC-SHA256).
 *
 * Razorpay sends razorpay_order_id + "|" + razorpay_payment_id
 * signed with the key secret.
 */
function verifyPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new ValidationError('razorpayOrderId, razorpayPaymentId and razorpaySignature are required');
  }

  const secret    = process.env.RAZORPAY_KEY_SECRET;
  const body      = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected  = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(razorpaySignature, 'hex'))) {
    throw new ValidationError('Payment signature verification failed');
  }

  logger.info({ event: 'razorpay_payment_verified', razorpayOrderId, razorpayPaymentId });
  return { verified: true, razorpayOrderId, razorpayPaymentId };
}

module.exports = { createOrder, verifyPayment };
