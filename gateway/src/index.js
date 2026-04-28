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
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');

// ─── Downstream service URLs ──────────────────────────────────────────────────
const SVC_USER         = process.env.SVC_USER_URL         || 'http://svc-user:3001';
const SVC_LISTING      = process.env.SVC_LISTING_URL      || 'http://svc-listing:3002';
const SVC_ORDER        = process.env.SVC_ORDER_URL        || 'http://svc-order:3003';
const SVC_PAYMENT      = process.env.SVC_PAYMENT_URL      || 'http://svc-payment:3004';
const SVC_LOGISTICS    = process.env.SVC_LOGISTICS_URL    || 'http://svc-logistics:3005';
const SVC_NOTIFICATION = process.env.SVC_NOTIFICATION_URL || 'http://svc-notification:3006';

function proxy(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    // Express's app.use(prefix, mw) strips the matched prefix from req.url
    // before the proxy sees it. Without this rewrite, /api/v1/auth/register
    // arrives at the upstream as /register and 404s — every service mounts
    // its routes at the full /api/v1/<svc> path. Forwarding originalUrl
    // restores what the client sent.
    pathRewrite: (_path, req) => req.originalUrl,
    on: {
      // express.json() / urlencoded() upstream of this proxy consume the
      // request body stream. Without fixRequestBody the upstream service
      // waits forever for a body that will never arrive and eventually
      // logs "request aborted" (ECONNABORTED). fixRequestBody re-encodes
      // req.body and writes it to the outbound proxy request.
      proxyReq: fixRequestBody,
      error: (err, req, res) => {
        logger.error({ event: 'proxy_error', target, path: req.path, error: err.message });
        if (!res.headersSent) {
          res.status(502).json({ success: false, code: 'GATEWAY_ERROR', error: 'Upstream service unavailable' });
        }
      },
    },
  });
}

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

// ─── API proxy routes ─────────────────────────────────────────────────────────
// All requests are forwarded to downstream microservices.
// The gateway handles auth rate-limiting, security headers, and TLS termination.
app.use('/api/v1/auth',          proxy(SVC_USER));
app.use('/api/v1/users',         proxy(SVC_USER));
app.use('/api/v1/listings',      proxy(SVC_LISTING));
app.use('/api/v1/orders',        proxy(SVC_ORDER));
app.use('/api/v1/payments',      proxy(SVC_PAYMENT));
app.use('/api/v1/logistics',     proxy(SVC_LOGISTICS));
app.use('/api/v1/notifications', proxy(SVC_NOTIFICATION));

app.get('/api/v1', (req, res) => res.json({
  name:    'AgriTrade API Gateway',
  version: '1.0.0',
  status:  'ok',
  services: ['user', 'listing', 'order', 'payment', 'logistics', 'notification'],
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
