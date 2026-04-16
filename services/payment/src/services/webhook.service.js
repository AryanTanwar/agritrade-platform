'use strict';

const crypto = require('crypto');
const logger = require('../../../shared/logger');
const { ValidationError } = require('../../../shared/error-handler');

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

/**
 * Process an incoming Razorpay webhook.
 *
 * The route handler MUST mount this path with express.raw() middleware so
 * req.body is a Buffer containing the raw JSON payload — required for
 * signature verification.
 *
 * @param {import('express').Request} req
 */
async function process(req) {
  const signature = req.headers['x-razorpay-signature'];

  if (!signature) throw new ValidationError('Missing Razorpay signature header');

  // req.body is a Buffer when using express.raw()
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

  // Verify HMAC
  if (WEBHOOK_SECRET) {
    const expected = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))) {
      throw new ValidationError('Webhook signature verification failed');
    }
  } else {
    logger.warn({ event: 'webhook_no_secret', note: 'RAZORPAY_WEBHOOK_SECRET not set — skipping signature check' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new ValidationError('Webhook payload is not valid JSON');
  }

  logger.info({ event: 'razorpay_webhook_received', type: event.event });

  switch (event.event) {
    case 'payment.captured':
      await _onPaymentCaptured(event.payload.payment.entity);
      break;

    case 'payment.failed':
      await _onPaymentFailed(event.payload.payment.entity);
      break;

    case 'refund.processed':
      await _onRefundProcessed(event.payload.refund.entity);
      break;

    default:
      logger.debug({ event: 'webhook_unhandled_type', type: event.event });
  }
}

async function _onPaymentCaptured(payment) {
  logger.info({
    event:   'payment_captured',
    paymentId: payment.id,
    orderId:   payment.order_id,
    amount:    payment.amount / 100,
  });
  // Additional business logic (e.g. update payment record in DB) can be added here
}

async function _onPaymentFailed(payment) {
  logger.warn({
    event:     'payment_failed',
    paymentId: payment.id,
    orderId:   payment.order_id,
    errorCode: payment.error_code,
  });
}

async function _onRefundProcessed(refund) {
  logger.info({
    event:    'refund_processed',
    refundId: refund.id,
    amount:   refund.amount / 100,
  });
}

module.exports = { process };
