'use strict';

const razorpayService = require('../services/razorpay.service');
const escrowService   = require('../services/escrow.service');
const webhookService  = require('../services/webhook.service');

async function createOrder(req, res, next) {
  try {
    const order = await razorpayService.createOrder(req.body);
    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
}

async function verifyPayment(req, res, next) {
  try {
    const result = await razorpayService.verifyPayment(req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function createEscrow(req, res, next) {
  try {
    const escrow = await escrowService.createEscrow(req.user, req.body);
    res.status(201).json({ success: true, data: escrow });
  } catch (err) { next(err); }
}

async function releaseEscrow(req, res, next) {
  try {
    const escrow = await escrowService.releaseEscrow(req.user, req.params.escrowId);
    res.json({ success: true, data: escrow });
  } catch (err) { next(err); }
}

async function refundEscrow(req, res, next) {
  try {
    const escrow = await escrowService.refundEscrow(req.user, req.params.escrowId);
    res.json({ success: true, data: escrow });
  } catch (err) { next(err); }
}

async function raiseDispute(req, res, next) {
  try {
    const escrow = await escrowService.raiseDispute(req.user, req.params.escrowId, req.body.reason);
    res.json({ success: true, data: escrow });
  } catch (err) { next(err); }
}

async function resolveDispute(req, res, next) {
  try {
    const escrow = await escrowService.resolveDispute(req.user, req.params.escrowId, req.body);
    res.json({ success: true, data: escrow });
  } catch (err) { next(err); }
}

async function getEscrow(req, res, next) {
  try {
    const escrow = await escrowService.getEscrow(req.user, req.params.escrowId);
    res.json({ success: true, data: escrow });
  } catch (err) { next(err); }
}

async function handleWebhook(req, res, next) {
  try {
    await webhookService.process(req);
    res.json({ status: 'ok' });
  } catch (err) { next(err); }
}

module.exports = {
  createOrder, verifyPayment,
  createEscrow, releaseEscrow, refundEscrow,
  raiseDispute, resolveDispute, getEscrow,
  handleWebhook,
};
