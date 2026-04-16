'use strict';

const { Router } = require('express');
const { authenticate } = require('../../../../shared/middleware/authenticate');
const userController = require('../controllers/user.controller');

const router = Router();

// ── Profile ────────────────────────────────────────────────────────────────────
router.get('/me', authenticate, userController.getMe);
router.put('/me', authenticate, userController.updateMe);
router.put('/me/password', authenticate, userController.changePassword);

// ── KYC ────────────────────────────────────────────────────────────────────────
router.post('/me/kyc', authenticate, userController.submitKYC);
router.get('/me/kyc', authenticate, userController.getKYCStatus);

module.exports = router;
