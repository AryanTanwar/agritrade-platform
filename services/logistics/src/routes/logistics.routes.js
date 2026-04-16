'use strict';

const router     = require('express').Router();
const controller = require('../controllers/logistics.controller');
const { authenticate, authorise } = require('../../../../shared/middleware/authenticate');

// Create a new shipment
router.post('/shipments',                       authenticate, authorise('logistics'), controller.createShipment);

// Get shipment details
router.get('/shipments/:shipmentId',            authenticate, controller.getShipment);

// Update GPS location
router.put('/shipments/:shipmentId/location',   authenticate, authorise('logistics'), controller.updateLocation);

// Record IoT sensor reading
router.post('/shipments/:shipmentId/iot',       authenticate, authorise('logistics'), controller.recordIoT);

// Advance shipment status
router.put('/shipments/:shipmentId/status',     authenticate, authorise('logistics'), controller.updateStatus);

// Confirm delivery (buyer signs off)
router.post('/shipments/:shipmentId/deliver',   authenticate, authorise('buyer'),     controller.confirmDelivery);

// Report damage
router.post('/shipments/:shipmentId/damage',    authenticate, authorise('logistics'), controller.reportDamage);

// List shipments for logged-in user
router.get('/shipments',                        authenticate, controller.listShipments);

// 3PL provider webhooks (Delhivery, Shiprocket, etc.)
router.post('/webhook/:provider', controller.handleTPLWebhook);

module.exports = router;
