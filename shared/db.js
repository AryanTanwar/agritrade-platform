'use strict';

const { Pool } = require('pg');
const logger   = require('./logger');

// ─── Connection pool ──────────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'agritrade',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  min:      parseInt(process.env.DB_POOL_MIN || '2', 10),
  max:      parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis:    30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  statement_timeout:       30_000,  // Kill queries running longer than 30s
  query_timeout:           30_000,
  application_name: `agritrade-${process.env.SERVICE_NAME || 'gateway'}`,
});

pool.on('connect', () => {
  logger.info({ event: 'db_pool_connect', host: process.env.DB_HOST });
});

pool.on('error', (err) => {
  logger.error({ event: 'db_pool_error', message: err.message });
});

// ─── Parameterised query helper ───────────────────────────────────────────────
/**
 * Execute a parameterised query. Always use $1, $2 placeholders — never
 * string-interpolate user input into SQL.
 *
 * @param {string}   text   SQL with $N placeholders
 * @param {Array}    params parameter values
 * @returns {Promise<pg.QueryResult>}
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const ms     = Date.now() - start;

    if (ms > 1_000) {
      logger.warn({ event: 'slow_query', ms, query: text.slice(0, 120) });
    }

    logger.debug({ event: 'db_query', ms, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error({ event: 'db_query_error', message: err.message, query: text.slice(0, 120) });
    throw err;
  }
}

/**
 * Execute multiple statements in a single transaction.
 * Rolls back automatically on any error.
 *
 * @param {Function} fn  async (client) => ...
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verify DB connectivity — used in /ready health check.
 */
async function healthCheck() {
  const result = await pool.query('SELECT 1 AS ok');
  return result.rows[0].ok === 1;
}

/**
 * Graceful shutdown — drain pool.
 */
async function closePool() {
  await pool.end();
  logger.info({ event: 'db_pool_closed' });
}

module.exports = { query, withTransaction, healthCheck, closePool, pool };
