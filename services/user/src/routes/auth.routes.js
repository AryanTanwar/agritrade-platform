'use strict';

const { Router } = require('express');
const { schemas, validate } = require('../../../../shared/validators');
const { authenticate } = require('../../../../shared/middleware/authenticate');
const authController = require('../controllers/auth.controller');

const router = Router();

// ── Registration ───────────────────────────────────────────────────────────────
router.post('/register/farmer', validate(schemas.registerFarmer), authController.registerFarmer);
router.post('/register/buyer', validate(schemas.registerBuyer), authController.registerBuyer);

// ── Authentication ─────────────────────────────────────────────────────────────
router.post('/login', validate(schemas.login), authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authenticate, authController.logout);

// ── OTP ────────────────────────────────────────────────────────────────────────
router.post('/otp/send', authController.sendOTP);
router.post('/otp/verify', validate(schemas.verifyOTP), authController.verifyOTP);

// ── TOTP / 2FA ─────────────────────────────────────────────────────────────────
router.post('/2fa/setup', authenticate, authController.setup2FA);
router.post('/2fa/verify', authenticate, authController.verify2FA);
router.delete('/2fa', authenticate, authController.disable2FA);

module.exports = router;
