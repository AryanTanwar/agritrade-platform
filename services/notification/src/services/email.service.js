'use strict';

const nodemailer = require('nodemailer');
const logger     = require('../../../shared/logger');

let _transporter;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST   || 'smtp.sendgrid.net',
      port:   parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool:           true,
      maxConnections: 5,
      maxMessages:    100,
    });
  }
  return _transporter;
}

const FROM_ADDRESS = process.env.EMAIL_FROM || 'no-reply@agritrade.in';

/**
 * Send an HTML email.
 *
 * @param {string} to      Recipient email address
 * @param {string} subject Email subject
 * @param {string} html    HTML body
 * @param {string} [text]  Plain-text fallback (auto-generated if omitted)
 */
async function sendEmail(to, subject, html, text) {
  if (process.env.NODE_ENV === 'test') {
    logger.info({ event: 'email_skipped_test', to, subject });
    return { messageId: 'TEST_MESSAGE_ID' };
  }

  const info = await getTransporter().sendMail({
    from:    FROM_ADDRESS,
    to,
    subject,
    html,
    text:    text || html.replace(/<[^>]+>/g, ''),  // strip HTML for fallback
  });

  logger.info({ event: 'email_sent', to, subject, messageId: info.messageId });
  return { messageId: info.messageId };
}

module.exports = { sendEmail };
