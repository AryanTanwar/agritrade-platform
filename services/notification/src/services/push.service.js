'use strict';

const logger = require('../../../../shared/logger');

let _app;
function getFirebase() {
  if (!_app) {
    const admin = require('firebase-admin');

    if (!admin.apps.length) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
        : null;

      admin.initializeApp({
        credential: serviceAccount
          ? admin.credential.cert(serviceAccount)
          : admin.credential.applicationDefault(),
      });
    }

    _app = admin;
  }
  return _app;
}

/**
 * Send a Firebase Cloud Messaging push notification.
 *
 * @param {string}  token   FCM device token
 * @param {string}  title   Notification title
 * @param {string}  body    Notification body
 * @param {Object}  [data]  Optional key-value data payload
 */
async function sendPush(token, title, body, data = {}) {
  if (process.env.NODE_ENV === 'test') {
    logger.info({ event: 'push_skipped_test', token: token.slice(0, 12), title });
    return { messageId: 'TEST_FCM_ID' };
  }

  const message = {
    token,
    notification: { title, body },
    data:         Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: { priority: 'high' },
    apns:    { payload: { aps: { sound: 'default' } } },
  };

  const messageId = await getFirebase().messaging().send(message);
  logger.info({ event: 'push_sent', token: token.slice(0, 12), title, messageId });
  return { messageId };
}

/**
 * Send to multiple tokens (multicast).
 */
async function sendPushMulticast(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) return;

  if (process.env.NODE_ENV === 'test') {
    logger.info({ event: 'push_multicast_skipped_test', count: tokens.length, title });
    return;
  }

  const message = {
    tokens,
    notification: { title, body },
    data:         Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: { priority: 'high' },
    apns:    { payload: { aps: { sound: 'default' } } },
  };

  const response = await getFirebase().messaging().sendEachForMulticast(message);
  logger.info({
    event:   'push_multicast_sent',
    total:   tokens.length,
    success: response.successCount,
    failure: response.failureCount,
  });
  return response;
}

module.exports = { sendPush, sendPushMulticast };
