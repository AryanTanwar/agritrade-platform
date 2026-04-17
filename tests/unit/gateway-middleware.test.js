'use strict';

const xssClean         = require('../../gateway/src/middleware/xss-clean');
const sqlGuard         = require('../../gateway/src/middleware/sqlInjection.guard');
const { contentTypeGuard, sanitizeBody } = require('../../gateway/src/middleware/requestValidator');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    method: 'POST',
    path:   '/api/v1/test',
    ip:     '127.0.0.1',
    headers: { 'content-type': 'application/json' },
    body:   {},
    query:  {},
    params: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {
    _status: 200,
    _body:   null,
    status(code) { this._status = code; return this; },
    json(body)   { this._body   = body; return this; },
  };
  return res;
}

// ─── XSS cleaning ─────────────────────────────────────────────────────────────
describe('xssClean middleware', () => {
  test('strips script tags from body strings', () => {
    const req  = mockReq({ body: { name: '<script>alert(1)</script>Farmer' } });
    const res  = mockRes();
    const next = jest.fn();
    xssClean(req, res, next);
    expect(req.body.name).not.toContain('<script>');
    expect(next).toHaveBeenCalled();
  });

  test('strips XSS from query params', () => {
    const req  = mockReq({ query: { q: '"><img src=x onerror=alert(1)>' } });
    const next = jest.fn();
    xssClean(req, mockRes(), next);
    expect(req.query.q).not.toContain('onerror');
    expect(next).toHaveBeenCalled();
  });

  test('passes safe strings through unchanged', () => {
    const req  = mockReq({ body: { name: 'Rajesh Kumar', village: 'Fatehpur' } });
    const next = jest.fn();
    xssClean(req, mockRes(), next);
    expect(req.body.name).toBe('Rajesh Kumar');
    expect(next).toHaveBeenCalled();
  });

  test('removes __proto__ keys (prototype pollution)', () => {
    // Object literal `{ __proto__: {...} }` sets the prototype rather than
    // creating an own key — sanitizeObject builds a fresh plain object with
    // the default prototype, so any polluted inherited property is dropped.
    const req  = mockReq({ body: { '__proto__': { admin: true }, name: 'valid' } });
    const next = jest.fn();
    xssClean(req, mockRes(), next);
    expect(req.body.admin).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

// ─── SQL injection guard ──────────────────────────────────────────────────────
describe('sqlInjectionGuard middleware', () => {
  test('blocks SELECT injection in body', () => {
    const req  = mockReq({ body: { name: "'; SELECT * FROM users; --" } });
    const res  = mockRes();
    const next = jest.fn();
    sqlGuard(req, res, next);
    expect(res._status).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('blocks UNION injection in query', () => {
    const req  = mockReq({ query: { id: '1 UNION SELECT password FROM users' } });
    const res  = mockRes();
    const next = jest.fn();
    sqlGuard(req, res, next);
    expect(res._status).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows normal query strings', () => {
    const req  = mockReq({ query: { district: 'Pune', state: 'Maharashtra' } });
    const next = jest.fn();
    sqlGuard(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── Content-type guard ───────────────────────────────────────────────────────
describe('contentTypeGuard middleware', () => {
  test('blocks POST with wrong content-type', () => {
    const req  = mockReq({ headers: { 'content-type': 'text/plain' } });
    const res  = mockRes();
    const next = jest.fn();
    contentTypeGuard(req, res, next);
    expect(res._status).toBe(415);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows GET without content-type', () => {
    const req  = mockReq({ method: 'GET', headers: {} });
    const next = jest.fn();
    contentTypeGuard(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('allows POST with application/json', () => {
    const req  = mockReq({ headers: { 'content-type': 'application/json' } });
    const next = jest.fn();
    contentTypeGuard(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── sanitizeBody ─────────────────────────────────────────────────────────────
describe('sanitizeBody middleware', () => {
  test('removes __proto__ from request body', () => {
    const req  = mockReq({ body: { valid: 'data', '__proto__': { isAdmin: true } } });
    const next = jest.fn();
    sanitizeBody(req, mockRes(), next);
    expect(JSON.stringify(req.body)).not.toContain('__proto__');
    expect(next).toHaveBeenCalled();
  });
});
