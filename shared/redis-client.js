'use strict';

const Redis  = require('ioredis');
const logger = require('./logger');

const redisConfig = {
  host:     process.env.REDIS_HOST     || 'localhost',
  port:     parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,

  // TLS in production
  ...(process.env.REDIS_TLS === 'true' && {
    tls: {
      rejectUnauthorized: true,
    },
  }),

  // Reconnect strategy: exponential backoff capped at 10s
  retryStrategy(times) {
    if (times > 10) {
      logger.error({ event: 'redis_connection_failed', attempts: times });
      return null; // stop retrying after 10 attempts
    }
    return Math.min(times * 200, 10_000);
  },

  // Disable offline queue so commands fail fast if Redis is down
  enableOfflineQueue:  false,
  connectTimeout:      5_000,
  commandTimeout:      3_000,
  maxRetriesPerRequest: 2,

  lazyConnect: true, // don't connect until first command
};

let client;

function getRedisClient() {
  if (client) return client;

  client = new Redis(redisConfig);

  client.on('connect', () => {
    logger.info({ event: 'redis_connected', host: redisConfig.host });
  });

  client.on('error', (err) => {
    logger.error({ event: 'redis_error', message: err.message });
  });

  client.on('close', () => {
    logger.warn({ event: 'redis_disconnected' });
  });

  return client;
}

/**
 * Gracefully disconnect Redis.
 * Call during application shutdown.
 */
async function closeRedis() {
  if (client) {
    await client.quit();
    client = null;
    logger.info({ event: 'redis_closed' });
  }
}

module.exports = getRedisClient();
module.exports.closeRedis = closeRedis;
