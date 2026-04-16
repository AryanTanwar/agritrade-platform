'use strict';

const authService = require('../services/auth.service');
const otpService = require('../services/otp.service');
const totpService = require('../services/totp.service');

/**
 * POST /api/v1/auth/register/farmer
 */
async function registerFarmer(req, res, next) {
  try {
    const user = await authService.register({ ...req.body, role: 'farmer' });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/register/buyer
 */
async function registerBuyer(req, res, next) {
  try {
    const user = await authService.register({ ...req.body });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/login
 */
async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);

    if (result.requires2FA) {
      return res.json({ success: true, data: { requires2FA: true, tempToken: result.tempToken } });
    }

    res.json({ success: true, data: { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/refresh
 */
async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;
    const tokens = await authService.refreshToken(token);
    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Requires: authenticate middleware (sets req.user)
 */
async function logout(req, res, next) {
  try {
    const { refreshToken: token } = req.body;
    await authService.logout(req.user.id, token);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/otp/send
 */
async function sendOTP(req, res, next) {
  try {
    await otpService.sendOTP(req.body.phone);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/otp/verify
 */
async function verifyOTP(req, res, next) {
  try {
    await otpService.verifyOTP(req.body.phone, req.body.otp);
    res.json({ success: true, verified: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/2fa/setup
 * Requires: authenticate middleware
 */
async function setup2FA(req, res, next) {
  try {
    const { secret, qrCodeUrl } = await totpService.setup(req.user.id);
    res.json({ success: true, data: { secret, qrCodeUrl } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/2fa/verify
 * Requires: authenticate middleware
 */
async function verify2FA(req, res, next) {
  try {
    await totpService.verify(req.user.id, req.body.token);
    res.json({ success: true, enabled: true });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/auth/2fa
 * Requires: authenticate middleware
 */
async function disable2FA(req, res, next) {
  try {
    await totpService.disable(req.user.id, req.body.password);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerFarmer,
  registerBuyer,
  login,
  refreshToken,
  logout,
  sendOTP,
  verifyOTP,
  setup2FA,
  verify2FA,
  disable2FA,
};
