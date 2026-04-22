'use strict';

const { Router } = require('express');
const { authenticate, authorise } = require('../../../../shared/middleware/authenticate');
const { validate, schemas } = require('../../../../shared/validators');
const orderController = require('../controllers/order.controller');

const router = Router();

// POST /api/v1/orders — place a new order (buyer only)
router.post(
  '/',
  authenticate,
  authorise('buyer'),
  validate(schemas.createOrder),
  orderController.place
);

// GET /api/v1/orders — list orders for authenticated user
router.get('/', authenticate, orderController.listMyOrders);

// GET /api/v1/orders/:id — get single order
router.get('/:id', authenticate, orderController.getById);

// POST /api/v1/orders/:id/confirm — farmer confirms order
router.post('/:id/confirm', authenticate, authorise('farmer'), orderController.confirm);

// POST /api/v1/orders/:id/escrow — farmer attaches escrow
router.post('/:id/escrow', authenticate, authorise('farmer'), orderController.attachEscrow);

// POST /api/v1/orders/:id/in-transit — farmer marks shipment dispatched
router.post('/:id/in-transit', authenticate, authorise('farmer'), orderController.markInTransit);

// POST /api/v1/orders/:id/deliver — buyer confirms delivery
router.post('/:id/deliver', authenticate, authorise('buyer'), orderController.confirmDelivery);

// POST /api/v1/orders/:id/complete — farmer marks order complete
router.post('/:id/complete', authenticate, authorise('farmer'), orderController.complete);

// POST /api/v1/orders/:id/dispute — any party raises a dispute
router.post('/:id/dispute', authenticate, orderController.dispute);

// POST /api/v1/orders/:id/cancel — any party cancels (within allowed states)
router.post('/:id/cancel', authenticate, orderController.cancel);

// GET /api/v1/orders/:id/history — audit trail for an order
router.get('/:id/history', authenticate, orderController.history);

module.exports = router;
