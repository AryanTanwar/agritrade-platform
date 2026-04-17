'use strict';

const userService = require('../services/user.service');
const authService = require('../services/auth.service');

/**
 * GET /api/v1/users/me
 * Requires: authenticate middleware
 */
async function getMe(req, res, next) {
  try {
    const user = await userService.getById(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/users/me
 * Requires: authenticate middleware
 */
async function updateMe(req, res, next) {
  try {
    const user = await userService.update(req.user.id, req.body);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/users/me/password
 * Requires: authenticate middleware
 */
async function changePassword(req, res, next) {
  try {
    await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/users/me/kyc
 * Requires: authenticate middleware
 */
async function submitKYC(req, res, next) {
  try {
    const kyc = await userService.submitKYC(req.user.id, req.body);
    res.status(201).json({ success: true, data: kyc });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/users/me/kyc
 * Requires: authenticate middleware
 */
async function getKYCStatus(req, res, next) {
  try {
    const kyc = await userService.getKYCStatus(req.user.id);
    res.json({ success: true, data: kyc });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  updateMe,
  changePassword,
  submitKYC,
  getKYCStatus,
};
