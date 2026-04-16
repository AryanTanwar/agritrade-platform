'use strict';

require('dotenv').config();

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const hpp         = require('hpp');
const compression = require('compression');
const morgan      = require('morgan');

const paymentRoutes = require('./routes/payment.routes');
const logger        = require('../../../shared/logger');
const db            = require('../../../shared/db');
const redis         = require('../../../shared/redis-client');
const { globalErrorHandler, notFoundHandler } = require('../../../shared/error-handler');

const app  = express();
const PORT = process.env.PORT || 3004;

app.set('trust proxy', 1);

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
app.use(hpp());

// ─── Body parsing ─────────────────────────────────────────────────────────────
// Raw body needed for Razorpay webhook signature verification — keep both
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json', limit: '20kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(compression());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info({ event: 'http_access', msg: msg.trim() }) },
  }));
}

// ─── Health / readiness ───────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment', uptime: process.uptime() });
});

app.get('/ready', async (req, res, next) => {
  try {
    await db.healthCheck();
    res.json({ status: 'ready' });
  } catch (err) {
    next(err);
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/payments', paymentRoutes);

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info({ event: 'service_start', service: 'payment', port: PORT });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info({ event: 'shutdown_start', signal });
  server.close(async () => {
    await db.closePool();
    await redis.closeRedis();
    logger.info({ event: 'shutdown_complete' });
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app;
