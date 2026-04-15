'use strict';

require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const compression = require('compression');
const hpp        = require('hpp');

const helmetConfig                       = require('./middleware/helmet.config');
const corsConfig                         = require('./middleware/cors.config');
const { globalLimiter }                  = require('./middleware/rate-limiter');
const xssClean                           = require('./middleware/xss-clean');
const sqlInjectionGuard                  = require('./middleware/sqlInjection.guard');
const { requestId, contentTypeGuard, sanitizeBody } = require('./middleware/requestValidator');
const { globalErrorHandler, notFoundHandler }        = require('../../shared/error-handler');
const logger                             = require('../../shared/logger');

// ─── Route imports (added phase by phase) ─────────────────────────────────────
// const authRoutes     = require('./routes/auth.routes');
// const listingRoutes  = require('./routes/listing.routes');
// const orderRoutes    = require('./routes/order.routes');
// const paymentRoutes  = require('./routes/payment.routes');
// const logisticsRoutes = require('./routes/logistics.routes');

const app  = express();
const PORT = process.env.GATEWAY_PORT || 8080;

// ─── Trust proxy (behind nginx/k8s ingress) ───────────────────────────────────
app.set('trust proxy', 1);

// ─── Security middleware (applied first) ─────────────────────────────────────
app.use(helmet(helmetConfig));
app.use(cors(corsConfig));
app.use(hpp());                // Prevent HTTP Parameter Pollution
app.use(globalLimiter);

// ─── Request enrichment ───────────────────────────────────────────────────────
app.use(requestId);
app.use(logger.middleware);

// ─── Body parsing (size limits to prevent DoS) ────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Input sanitisation ───────────────────────────────────────────────────────
app.use(xssClean);
app.use(sqlInjectionGuard);
app.use(contentTypeGuard);
app.use(sanitizeBody);

// ─── Response compression ────────────────────────────────────────────────────
app.use(compression());

// ─── HTTP request logging (skip in test) ─────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info({ event: 'http_access', msg: msg.trim() }) },
    skip:   (req) => req.path === '/health',
  }));
}

// ─── Health & readiness checks ────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
app.get('/ready',  async (req, res) => {
  try {
    // TODO: check DB + Redis + Fabric connectivity
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not_ready', error: err.message });
  }
});

// ─── API routes ───────────────────────────────────────────────────────────────
// app.use('/api/v1/auth',      authRoutes);
// app.use('/api/v1/listings',  listingRoutes);
// app.use('/api/v1/orders',    orderRoutes);
// app.use('/api/v1/payments',  paymentRoutes);
// app.use('/api/v1/logistics', logisticsRoutes);

// Placeholder — remove once real routes are wired
app.get('/api/v1', (req, res) => res.json({
  name:    'AgriTrade API',
  version: '1.0.0',
  status:  'Phase 1 scaffold ready',
}));

// ─── Error handling (must be last) ───────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info({ event: 'server_start', port: PORT, env: process.env.NODE_ENV });
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info({ event: 'shutdown', signal });
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // Unhandled promise rejections — log and exit (let k8s restart)
  process.on('unhandledRejection', (reason) => {
    logger.error({ event: 'unhandled_rejection', reason: String(reason) });
    process.exit(1);
  });
}

module.exports = app; // export for testing
