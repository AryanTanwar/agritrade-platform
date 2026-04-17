'use strict';

const notificationService = require('../services/notification.service');

async function send(req, res, next) {
  try {
    await notificationService.dispatch(req.body);
    res.status(202).json({ success: true });
  } catch (err) { next(err); }
}

async function registerToken(req, res, next) {
  try {
    await notificationService.registerPushToken(req.user.id, req.body.token, req.body.platform);
    res.status(201).json({ success: true });
  } catch (err) { next(err); }
}

async function revokeToken(req, res, next) {
  try {
    await notificationService.revokePushToken(req.user.id, req.params.token);
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const result = await notificationService.listForUser(req.user.id, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    await notificationService.markRead(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function markAllRead(req, res, next) {
  try {
    await notificationService.markAllRead(req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { send, registerToken, revokeToken, list, markRead, markAllRead };
