'use strict';

const router     = require('express').Router();
const controller = require('../controllers/notification.controller');
const { authenticate } = require('../../../../shared/middleware/authenticate');

// Internal endpoint: other services POST here to send notifications
router.post('/send',             authenticate, controller.send);

// Register or update FCM/APNS push token for a device
router.post('/tokens',           authenticate, controller.registerToken);

// Delete push token on logout
router.delete('/tokens/:token',  authenticate, controller.revokeToken);

// Get notification history for the authenticated user
router.get('/',                  authenticate, controller.list);

// Mark one notification as read
router.put('/:id/read',          authenticate, controller.markRead);

// Mark all as read
router.put('/read-all',          authenticate, controller.markAllRead);

module.exports = router;
