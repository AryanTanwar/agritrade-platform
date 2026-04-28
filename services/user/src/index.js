'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const compression = require('compression');
const morgan = require('morgan');

const logger = require('../../../shared/logger');
const db = require('../../../shared/db');
const redis = require('../../../shared/redis-client');
const { globalErrorHandler, notFoundHandler } = require('../../../shared/error-handler');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security & utility middleware ──────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(hpp());
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Health / readiness probes ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'user', uptime: process.uptime() });
});

app.get('/ready', async (_req, res, next) => {
  try {
    await db.healthCheck();
    res.json({ status: 'ready', service: 'user' });
  } catch (err) {
    next(err);
  }
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/', authRoutes);
app.use('/', userRoutes);

// ── 404 & global error handlers ───────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ── Server start ───────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info({ event: 'server_started', service: 'user', port: PORT });
});

// ── Graceful shutdown ──────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info({ event: 'shutdown_initiated', signal });

  server.close(async () => {
    try {
      await db.closePool();
      logger.info({ event: 'db_pool_closed' });
    } catch (err) {
      logger.error({ event: 'db_pool_close_error', error: err.message });
    }

    try {
      await redis.closeRedis();
      logger.info({ event: 'redis_closed' });
    } catch (err) {
      logger.error({ event: 'redis_close_error', error: err.message });
    }

    logger.info({ event: 'shutdown_complete' });
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error({ event: 'shutdown_timeout', message: 'Forcing exit after 10s timeout' });
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app; // for testing
