'use strict';

const orderService = require('../services/order.service');

/**
 * POST /api/v1/orders
 * Place a new order (buyer only).
 */
async function place(req, res, next) {
  try {
    const order = await orderService.placeOrder(req.user, req.body);
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/orders
 * List all orders for the authenticated user (buyer or farmer view).
 */
async function listMyOrders(req, res, next) {
  try {
    const { orders, total, page, limit } = await orderService.listByUser(req.user, req.query);
    res.json({
      success: true,
      data: orders,
      meta: { total, page, limit },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/orders/:id
 * Retrieve a single order by ID (accessible by buyer or farmer on the order).
 */
async function getById(req, res, next) {
  try {
    const order = await orderService.getById(req.user.id, req.params.id);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/orders/:id/confirm
 * Farmer confirms the order.
 */
async function confirm(req, res, next) {
  try {
    const order = await orderService.confirm(req.user.id, req.params.id);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/orders/:id/escrow
 * Farmer attaches an escrow transaction to the order.
 */
async function attachEscrow(req, res, next) {
  try {
    const order = await orderService.attachEscrow(req.user.id, req.params.id, req.body.escrowId);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/orders/:id/in-transit
 * Farmer marks the order as dispatched / in transit.
 */
async function markInTransit(req, res, next) {
  try {
    const order = await orderService.markInTransit(req.user.id, req.params.id, req.body.shipmentId);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/orders/:id/deliver
 * Buyer confirms delivery of the order.
 */
async function confirmDelivery(req, res, next) {
  try {
    const order = await orderService.confirmDelivery(req.user.id, req.params.id);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/orders/:id/complete
 * Farmer marks the order as fully complete (funds released).
 */
async function complete(req, res, next) {
  try {
    const order = await orderService.complete(req.user.id, req.params.id);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/orders/:id/dispute
 * Either party raises a dispute.
 */
async function dispute(req, res, next) {
  try {
    const order = await orderService.dispute(req.user.id, req.params.id, req.body.reason);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/orders/:id/cancel
 * Either party cancels the order (allowed only in early states).
 */
async function cancel(req, res, next) {
  try {
    const order = await orderService.cancel(req.user.id, req.params.id, req.body.reason);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/orders/:id/history
 * Returns the full event/audit trail for an order.
 */
async function history(req, res, next) {
  try {
    const events = await orderService.getHistory(req.user.id, req.params.id);
    res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  place,
  listMyOrders,
  getById,
  confirm,
  attachEscrow,
  markInTransit,
  confirmDelivery,
  complete,
  dispute,
  cancel,
  history,
};
