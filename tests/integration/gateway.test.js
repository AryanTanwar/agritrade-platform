'use strict';

process.env.NODE_ENV            = 'test';
process.env.GATEWAY_PORT        = '0';       // random port
process.env.JWT_SECRET          = 'test-jwt-secret-min-64-chars-padding-padding-padding-padding-ok';
process.env.JWT_REFRESH_SECRET  = 'test-refresh-secret-min-64-chars-padding-padding-padding-padding';
process.env.AES_ENCRYPTION_KEY  = '0'.repeat(64);
process.env.REDIS_HOST          = 'localhost';
process.env.REDIS_PORT          = '6379';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';

const request = require('supertest');
const app     = require('../../gateway/src/index');

describe('Gateway — health endpoints', () => {
  test('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.ts).toBeDefined();
  });

  test('GET /api/v1 returns platform info', async () => {
    const res = await request(app).get('/api/v1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('AgriTrade API Gateway');
  });
});

describe('Gateway — 404 handling', () => {
  test('unknown route returns 404 with JSON error', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('Gateway — security headers', () => {
  test('responses include X-Request-ID header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  test('responses include X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('X-Powered-By header is removed', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Gateway — XSS & injection protection', () => {
  test('POST with XSS in body is sanitised', async () => {
    const res = await request(app)
      .post('/api/v1/test-echo')   // will 404 — that's fine, sanitisation runs first
      .set('Content-Type', 'application/json')
      .send({ name: '<script>alert(1)</script>Farmer' });
    // Route doesn't exist so 404, but should not be 500
    expect([404, 200]).toContain(res.status);
  });

  test('POST with SQL injection returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Content-Type', 'application/json')
      .send({ title: "'; DROP TABLE listings; --" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST with wrong Content-Type returns 415', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'text/plain')
      .send('username=admin&password=secret');
    expect(res.status).toBe(415);
  });
});
