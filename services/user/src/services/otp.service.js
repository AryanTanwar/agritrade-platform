'use strict';

const crypto = require('crypto');
const redis = require('../../../../shared/redis-client');
const { ValidationError } = require('../../../../shared/error-handler');
const logger = require('../../../../shared/logger');

// Twilio client — lazy initialised to avoid loading at import time in tests
let twilioClient;
function getTwilio() {
  if (!twilioClient) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

const OTP_TTL_SECONDS = 10 * 60;    // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN = 60;     // 1 minute

/**
 * Generate a cryptographically secure 6-digit OTP.
 * @returns {string}
 */
function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

/**
 * Generate and dispatch an OTP to the given phone number.
 * In test environments the OTP is only logged (Twilio is skipped).
 *
 * @param {string} phone - E.164 phone number
 */
async function sendOTP(phone) {
  const cooldownKey = `otp:cooldown:${phone}`;
  const onCooldown = await redis.exists(cooldownKey);
  if (onCooldown) {
    throw new ValidationError('OTP was recently sent. Please wait 60 seconds.');
  }

  const otp = generateOTP();
  const otpKey = `otp:${phone}`;
  const attemptsKey = `otp:attempts:${phone}`;

  // Store OTP and set cooldown; reset any existing attempt counter
  await redis.setex(otpKey, OTP_TTL_SECONDS, otp);
  await redis.setex(cooldownKey, OTP_RESEND_COOLDOWN, '1');
  await redis.del(attemptsKey);

  if (process.env.NODE_ENV !== 'test') {
    try {
      await getTwilio().messages.create({
        body: `Your AgriTrade OTP is ${otp}. Valid for 10 minutes.`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: phone,
      });
    } catch (err) {
      logger.error({ event: 'otp_send_failed', phone, error: err.message });
      throw new Error('Failed to send OTP. Please try again.');
    }
  } else {
    logger.info({ event: 'otp_generated_test', phone, otp });
  }
}

/**
 * Verify the supplied OTP for a given phone number.
 * Enforces an attempt limit and cleans up Redis keys on success.
 *
 * @param {string} phone - E.164 phone number
 * @param {string} inputOtp - The OTP provided by the user
 * @returns {true}
 * @throws {ValidationError} on invalid/expired OTP or too many attempts
 */
async function verifyOTP(phone, inputOtp) {
  const otpKey = `otp:${phone}`;
  const attemptsKey = `otp:attempts:${phone}`;

  const attempts = parseInt(await redis.get(attemptsKey) || '0', 10);
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(otpKey);
    throw new ValidationError('Too many failed attempts. Please request a new OTP.');
  }

  const storedOtp = await redis.get(otpKey);
  if (!storedOtp) {
    throw new ValidationError('OTP expired or not found. Please request a new one.');
  }

  if (storedOtp !== inputOtp) {
    await redis.incr(attemptsKey);
    await redis.expire(attemptsKey, OTP_TTL_SECONDS);
    throw new ValidationError('Invalid OTP');
  }

  // Successful verification — clean up all related keys
  await redis.del(otpKey);
  await redis.del(attemptsKey);
  return true;
}

module.exports = { sendOTP, verifyOTP };
