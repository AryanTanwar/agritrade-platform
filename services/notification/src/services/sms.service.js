'use strict';

const logger = require('../../../shared/logger');

let _client;
function getTwilio() {
  if (!_client) {
    const twilio = require('twilio');
    _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return _client;
}

/**
 * Send an SMS via Twilio.
 *
 * @param {string} to      E.164 phone number (+91XXXXXXXXXX)
 * @param {string} message Message body (max 160 chars for single SMS)
 */
async function sendSMS(to, message) {
  if (process.env.NODE_ENV === 'test') {
    logger.info({ event: 'sms_skipped_test', to, message });
    return { sid: 'TEST_SID' };
  }

  const result = await getTwilio().messages.create({
    body: message,
    from: process.env.TWILIO_FROM_NUMBER,
    to,
  });

  logger.info({ event: 'sms_sent', to, sid: result.sid });
  return { sid: result.sid };
}

module.exports = { sendSMS };
