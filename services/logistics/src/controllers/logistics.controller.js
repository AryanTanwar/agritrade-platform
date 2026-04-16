'use strict';

const shipmentService = require('../services/shipment.service');
const tplService      = require('../services/tpl.service');

async function createShipment(req, res, next) {
  try {
    const shipment = await shipmentService.create(req.user, req.body);
    res.status(201).json({ success: true, data: shipment });
  } catch (err) { next(err); }
}

async function getShipment(req, res, next) {
  try {
    const shipment = await shipmentService.getById(req.user.id, req.params.shipmentId);
    res.json({ success: true, data: shipment });
  } catch (err) { next(err); }
}

async function updateLocation(req, res, next) {
  try {
    const shipment = await shipmentService.updateLocation(req.user.id, req.params.shipmentId, req.body);
    res.json({ success: true, data: shipment });
  } catch (err) { next(err); }
}

async function recordIoT(req, res, next) {
  try {
    const shipment = await shipmentService.recordIoT(req.user.id, req.params.shipmentId, req.body);
    res.json({ success: true, data: shipment });
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const shipment = await shipmentService.updateStatus(req.user.id, req.params.shipmentId, req.body.status);
    res.json({ success: true, data: shipment });
  } catch (err) { next(err); }
}

async function confirmDelivery(req, res, next) {
  try {
    const shipment = await shipmentService.confirmDelivery(req.user.id, req.params.shipmentId, req.body.proofHash);
    res.json({ success: true, data: shipment });
  } catch (err) { next(err); }
}

async function reportDamage(req, res, next) {
  try {
    const shipment = await shipmentService.reportDamage(req.user.id, req.params.shipmentId, req.body.notes);
    res.json({ success: true, data: shipment });
  } catch (err) { next(err); }
}

async function listShipments(req, res, next) {
  try {
    const result = await shipmentService.list(req.user, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function handleTPLWebhook(req, res, next) {
  try {
    await tplService.handleWebhook(req.params.provider, req.headers, req.body);
    res.json({ status: 'ok' });
  } catch (err) { next(err); }
}

module.exports = {
  createShipment, getShipment, updateLocation, recordIoT,
  updateStatus, confirmDelivery, reportDamage, listShipments,
  handleTPLWebhook,
};
