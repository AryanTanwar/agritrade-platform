'use strict';

const router     = require('express').Router();
const controller = require('../controllers/payment.controller');
const { authenticate, authorise } = require('../../../../shared/middleware/authenticate');

// Create Razorpay order (buyer initiates payment)
router.post('/order',   authenticate, authorise('buyer'), controller.createOrder);

// Verify payment signature after Razorpay callback
router.post('/verify',  authenticate, authorise('buyer'), controller.verifyPayment);

// Create escrow hold (called after payment verified)
router.post('/escrow',  authenticate, authorise('buyer'), controller.createEscrow);

// Release escrow (farmer claims funds after delivery)
router.post('/escrow/:escrowId/release', authenticate, authorise('farmer'), controller.releaseEscrow);

// Refund escrow (buyer reclaims funds on cancellation)
router.post('/escrow/:escrowId/refund',  authenticate, authorise('buyer'),  controller.refundEscrow);

// Raise a payment dispute
router.post('/escrow/:escrowId/dispute', authenticate, controller.raiseDispute);

// Resolve a dispute (platform admin or arbitrator)
router.post('/escrow/:escrowId/resolve', authenticate, controller.resolveDispute);

// Get escrow details
router.get('/escrow/:escrowId',          authenticate, controller.getEscrow);

// Razorpay webhook — raw body, signature verified internally
router.post('/webhook', controller.handleWebhook);

module.exports = router;
