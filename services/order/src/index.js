'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const compression = require('compression');
const morgan = require('morgan');

const db = require('../../../shared/db');
const logger = require('../../../shared/logger');
const { notFoundHandler, globalErrorHandler } = require('../../../shared/error-handler');
const orderRoutes = require('./routes/order.routes');

const app = express();
const PORT = process.env.PORT || 3003;

// Security and parsing middleware
app.use(helmet());
app.use(cors());
app.use(hpp());
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Health and readiness probes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order', uptime: process.uptime() });
});

app.get('/ready', async (req, res, next) => {
  try {
    await db.healthCheck();
    res.json({ status: 'ready', service: 'order' });
  } catch (err) {
    next(err);
  }
});

// API routes
app.use('/api/v1/orders', orderRoutes);

// Error handling
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info({ event: 'server_start', service: 'order', port: PORT });
});

// Graceful shutdown
async function shutdown(signal) {
  logger.info({ event: 'shutdown_signal', signal });
  server.close(async () => {
    try {
      await db.closePool();
      logger.info({ event: 'shutdown_complete', service: 'order' });
      process.exit(0);
    } catch (err) {
      logger.error({ event: 'shutdown_error', error: err.message });
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
