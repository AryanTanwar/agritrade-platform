'use strict';

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, errors, json, colorize, printf } = format;

// ─── Sensitive field redaction ────────────────────────────────────────────────
const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
  'secret', 'privateKey', 'aesKey', 'jwtSecret', 'apiKey',
  'cardNumber', 'cvv', 'otp', 'pin',
]);

function redactSensitive(info) {
  const redact = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const out = Array.isArray(obj) ? [] : {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : redact(v);
    }
    return out;
  };
  return { ...info, ...redact(info) };
}

const redactFormat = format((info) => redactSensitive(info))();

// ─── Dev console format ───────────────────────────────────────────────────────
const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, requestId, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const reqStr  = requestId ? ` [${requestId}]` : '';
    return `${ts}${reqStr} ${level}: ${message}${metaStr}`;
  })
);

// ─── Production JSON format ───────────────────────────────────────────────────
const prodFormat = combine(
  redactFormat,
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  defaultMeta: {
    service:     process.env.APP_NAME || 'agritrade',
    environment: process.env.NODE_ENV,
  },
  transports: [
    new transports.Console(),
    // In production, ship logs to a file that Loki/Fluentd tails
    ...(process.env.NODE_ENV === 'production'
      ? [
          new transports.File({ filename: '/var/log/agritrade/error.log', level: 'error' }),
          new transports.File({ filename: '/var/log/agritrade/combined.log' }),
        ]
      : []),
  ],
  // Catch unhandled exceptions / rejections
  exceptionHandlers: [new transports.Console()],
  rejectionHandlers: [new transports.Console()],
});

/**
 * Express middleware — attaches request metadata to each log call.
 */
logger.middleware = function (req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    logger.info({
      event:     'http_request',
      requestId: req.id,
      method:    req.method,
      path:      req.path,
      status:    res.statusCode,
      ms:        Date.now() - start,
      ip:        req.ip,
      userAgent: req.headers['user-agent'],
      userId:    req.user?.id,
    });
  });

  next();
};

module.exports = logger;
