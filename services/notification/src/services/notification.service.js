'use strict';

const { v4: uuidv4 } = require('uuid');
const db             = require('../../../shared/db');
const redis          = require('../../../shared/redis-client');
const smsService     = require('./sms.service');
const emailService   = require('./email.service');
const pushService    = require('./push.service');
const logger         = require('../../../shared/logger');
const { ValidationError } = require('../../../shared/error-handler');

const DEDUP_TTL_SECONDS = 300; // 5 minutes — suppress duplicate sends

// ─── Templates ────────────────────────────────────────────────────────────────
const TEMPLATES = {
  ORDER_PLACED: {
    sms:   (d) => `AgriTrade: Your order #${d.orderId} has been placed for ₹${d.amount}. Track it in the app.`,
    email: (d) => ({ subject: 'Order Placed — AgriTrade', html: `<p>Your order <b>#${d.orderId}</b> has been placed for ₹${d.amount}.</p>` }),
    push:  (d) => ({ title: 'Order Placed', body: `Order #${d.orderId} placed for ₹${d.amount}` }),
  },
  ORDER_CONFIRMED: {
    sms:   (d) => `AgriTrade: Farmer confirmed your order #${d.orderId}. Payment will be held in escrow.`,
    email: (d) => ({ subject: 'Order Confirmed', html: `<p>Your order <b>#${d.orderId}</b> has been confirmed by the farmer.</p>` }),
    push:  (d) => ({ title: 'Order Confirmed', body: `Your order #${d.orderId} has been confirmed` }),
  },
  SHIPMENT_DISPATCHED: {
    sms:   (d) => `AgriTrade: Your order is on its way! Tracking: ${d.trackingId}`,
    email: (d) => ({ subject: 'Shipment Dispatched', html: `<p>Your order is dispatched. Tracking ID: <b>${d.trackingId}</b></p>` }),
    push:  (d) => ({ title: 'Shipment Dispatched', body: `Tracking: ${d.trackingId}` }),
  },
  SHIPMENT_DELIVERED: {
    sms:   (d) => `AgriTrade: Order #${d.orderId} delivered. Please confirm receipt in the app.`,
    email: (d) => ({ subject: 'Order Delivered', html: `<p>Your order <b>#${d.orderId}</b> has been delivered. Please confirm receipt.</p>` }),
    push:  (d) => ({ title: 'Order Delivered', body: 'Please confirm receipt in the app' }),
  },
  PAYMENT_RELEASED: {
    sms:   (d) => `AgriTrade: ₹${d.amount} has been released to your account for order #${d.orderId}.`,
    email: (d) => ({ subject: 'Payment Released', html: `<p>₹<b>${d.amount}</b> released for order <b>#${d.orderId}</b>.</p>` }),
    push:  (d) => ({ title: 'Payment Released', body: `₹${d.amount} released to your account` }),
  },
  OTP: {
    sms:   (d) => `Your AgriTrade OTP is ${d.otp}. Valid for 10 minutes. Do not share.`,
    email: null,
    push:  null,
  },
};

// ─── Core dispatch ────────────────────────────────────────────────────────────

/**
 * Dispatch a notification to a user.
 *
 * @param {Object} opts
 * @param {string}   opts.userId     Recipient user ID
 * @param {string}   opts.type       Notification type (key in TEMPLATES)
 * @param {Object}   opts.data       Template variables
 * @param {string[]} [opts.channels] Which channels to use ('sms','email','push')
 */
async function dispatch({ userId, type, data = {}, channels }) {
  if (!userId) throw new ValidationError('userId is required');
  if (!type)   throw new ValidationError('type is required');

  // De-duplication: skip if same userId+type+data was sent < 5 minutes ago
  const dedupKey   = `notif:dedup:${userId}:${type}:${JSON.stringify(data)}`;
  const isDuplicate = await redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
  if (!isDuplicate) {
    logger.debug({ event: 'notification_deduped', userId, type });
    return;
  }

  // Resolve template
  const template = TEMPLATES[type];
  if (!template) {
    logger.warn({ event: 'notification_unknown_type', type });
    return;
  }

  // Load user contact details
  const userResult = await db.query('SELECT phone, email FROM users WHERE id = $1', [userId]);
  const user       = userResult.rows[0];
  if (!user) {
    logger.warn({ event: 'notification_user_not_found', userId });
    return;
  }

  const activeChannels = channels || ['sms', 'push'];
  const errors         = [];

  // ── SMS ──────────────────────────────────────────────────────────────────────
  if (activeChannels.includes('sms') && template.sms && user.phone) {
    try {
      await smsService.sendSMS(user.phone, template.sms(data));
    } catch (err) {
      errors.push({ channel: 'sms', error: err.message });
      logger.error({ event: 'notification_sms_failed', userId, type, error: err.message });
    }
  }

  // ── Email ────────────────────────────────────────────────────────────────────
  if (activeChannels.includes('email') && template.email && user.email) {
    try {
      const { subject, html } = template.email(data);
      await emailService.sendEmail(user.email, subject, html);
    } catch (err) {
      errors.push({ channel: 'email', error: err.message });
      logger.error({ event: 'notification_email_failed', userId, type, error: err.message });
    }
  }

  // ── Push ─────────────────────────────────────────────────────────────────────
  if (activeChannels.includes('push') && template.push) {
    const tokenResult = await db.query(
      "SELECT token FROM push_tokens WHERE user_id = $1 AND revoked = false",
      [userId]
    );
    if (tokenResult.rows.length) {
      const tokens = tokenResult.rows.map((r) => r.token);
      const { title, body } = template.push(data);
      try {
        await pushService.sendPushMulticast(tokens, title, body, data);
      } catch (err) {
        errors.push({ channel: 'push', error: err.message });
        logger.error({ event: 'notification_push_failed', userId, type, error: err.message });
      }
    }
  }

  // ── Persist notification record ───────────────────────────────────────────────
  await db.query(
    `INSERT INTO notifications (id, user_id, type, data, channels, errors, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [uuidv4(), userId, type, JSON.stringify(data), activeChannels, JSON.stringify(errors)]
  );

  logger.info({ event: 'notification_dispatched', userId, type, channels: activeChannels });
}

// ─── Push token management ────────────────────────────────────────────────────

async function registerPushToken(userId, token, platform = 'android') {
  if (!token) throw new ValidationError('token is required');

  await db.query(
    `INSERT INTO push_tokens (id, user_id, token, platform, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
     ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3, revoked = false, updated_at = NOW()`,
    [userId, token, platform]
  );
}

async function revokePushToken(userId, token) {
  await db.query(
    'UPDATE push_tokens SET revoked = true, updated_at = NOW() WHERE user_id = $1 AND token = $2',
    [userId, token]
  );
}

// ─── Notification history ─────────────────────────────────────────────────────

async function listForUser(userId, query) {
  const { page = 1, limit = 20 } = query;
  const offset = (Number(page) - 1) * Number(limit);

  const [rows, count] = await Promise.all([
    db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, Number(limit), offset]
    ),
    db.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1', [userId]),
  ]);

  return {
    notifications: rows.rows,
    total:  parseInt(count.rows[0].count, 10),
    page:   Number(page),
    limit:  Number(limit),
  };
}

async function markRead(userId, notificationId) {
  await db.query(
    'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );
}

async function markAllRead(userId) {
  await db.query(
    'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
    [userId]
  );
}

module.exports = {
  dispatch,
  registerPushToken, revokePushToken,
  listForUser, markRead, markAllRead,
};
