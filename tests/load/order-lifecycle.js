/**
 * k6 load test — Full order lifecycle
 *
 * Each VU walks the complete trade flow:
 *   buyer login → browse → place order → farmer login → confirm →
 *   farmer dispatch → buyer confirm delivery → farmer complete
 *
 * This hits the blockchain-backed order service on every state
 * transition, measuring end-to-end latency under concurrent load.
 *
 * Run:  k6 run tests/load/order-lifecycle.js -e BASE_URL=http://localhost:8080
 */

import http              from 'k6/http';
import { check, sleep }  from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate         = new Rate('order_error_rate');
const orderPlaceLatency = new Trend('order_place_latency_ms');
const confirmLatency    = new Trend('order_confirm_latency_ms');
const transitLatency    = new Trend('order_transit_latency_ms');
const deliverLatency    = new Trend('order_deliver_latency_ms');
const completeLatency   = new Trend('order_complete_latency_ms');
const lifecycleLatency  = new Trend('order_full_lifecycle_ms');
const completedOrders   = new Counter('orders_completed');

export const options = {
  scenarios: {
    // Low VU count — each iteration is a full multi-step flow
    order_flow: {
      executor:  'constant-vus',
      vus:       20,
      duration:  '3m',
    },
  },
  thresholds: {
    'order_place_latency_ms':     ['p(95)<1000'],
    'order_confirm_latency_ms':   ['p(95)<1500'],   // blockchain write
    'order_transit_latency_ms':   ['p(95)<1500'],
    'order_deliver_latency_ms':   ['p(95)<1500'],
    'order_complete_latency_ms':  ['p(95)<1500'],
    'order_full_lifecycle_ms':    ['p(95)<8000'],
    'order_error_rate':           ['rate<0.05'],
    'http_req_failed':            ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API      = `${BASE_URL}/api/v1`;

// Pre-seeded accounts — indexed so each VU uses its own pair
const FARMER_ACCOUNTS = Array.from({ length: 20 }, (_, i) => ({
  phone:    `+9198765${String(50000 + i).padStart(5, '0')}`,
  password: 'TestFarmer@123!',
}));
const BUYER_ACCOUNTS = Array.from({ length: 20 }, (_, i) => ({
  phone:    `+9187654${String(50000 + i).padStart(5, '0')}`,
  password: 'TestBuyer@123!',
}));
// A seeded listing that all VUs can place orders against
const SEED_LISTING_ID = __ENV.SEED_LISTING_ID || '';

function jsonHeaders(token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return { headers: h };
}

function login(phone, password) {
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ phone, password }),
    jsonHeaders()
  );
  check(res, { 'login ok': (r) => r.status === 200 });
  return res.json('token');
}

function post(path, body, token) {
  return http.post(
    `${API}${path}`,
    body ? JSON.stringify(body) : null,
    jsonHeaders(token)
  );
}

function get(path, token) {
  return http.get(`${API}${path}`, jsonHeaders(token));
}

export default function () {
  const idx        = (__VU - 1) % 20;
  const farmer     = FARMER_ACCOUNTS[idx];
  const buyer      = BUYER_ACCOUNTS[idx];
  const lifecycleStart = Date.now();

  // ── 1. Buyer: login ────────────────────────────────────────────────────────
  const buyerToken = login(buyer.phone, buyer.password);
  if (!buyerToken) { errorRate.add(1); return; }
  sleep(0.3);

  // ── 2. Buyer: find a listing ───────────────────────────────────────────────
  let listingId = SEED_LISTING_ID;
  if (!listingId) {
    const listRes = get('/listings?limit=5&category=grains', buyerToken);
    const items   = listRes.json('listings') || listRes.json('data') || [];
    if (items.length === 0) { errorRate.add(1); return; }
    listingId = items[0].id;
  }
  sleep(0.2);

  // ── 3. Buyer: place order ──────────────────────────────────────────────────
  const t0 = Date.now();
  const placeRes = post('/orders', {
    listing_id:       listingId,
    quantity:         1,
    delivery_address: '1 Load Test Lane, Test City, TC',
    delivery_pincode: '110001',
  }, buyerToken);
  orderPlaceLatency.add(Date.now() - t0);

  const placeOk = check(placeRes, {
    'place order 201': (r) => r.status === 201 || r.status === 200,
    'has order id':    (r) => !!(r.json('id') || r.json('order')?.id),
  });
  errorRate.add(!placeOk);
  if (!placeOk) return;

  const orderId = placeRes.json('id') || placeRes.json('order')?.id;
  sleep(0.5);

  // ── 4. Farmer: login + confirm ─────────────────────────────────────────────
  const farmerToken = login(farmer.phone, farmer.password);
  if (!farmerToken) { errorRate.add(1); return; }

  const t1 = Date.now();
  const confirmRes = post(`/orders/${orderId}/confirm`, null, farmerToken);
  confirmLatency.add(Date.now() - t1);
  check(confirmRes, { 'confirm 200': (r) => r.status === 200 || r.status === 204 });
  sleep(0.5);

  // ── 5. Farmer: mark in-transit ─────────────────────────────────────────────
  const t2 = Date.now();
  const transitRes = post(`/orders/${orderId}/in-transit`, null, farmerToken);
  transitLatency.add(Date.now() - t2);
  check(transitRes, { 'in-transit 200': (r) => r.status === 200 || r.status === 204 });
  sleep(0.5);

  // ── 6. Buyer: confirm delivery ─────────────────────────────────────────────
  const t3 = Date.now();
  const deliverRes = post(`/orders/${orderId}/deliver`, null, buyerToken);
  deliverLatency.add(Date.now() - t3);
  check(deliverRes, { 'deliver 200': (r) => r.status === 200 || r.status === 204 });
  sleep(0.5);

  // ── 7. Farmer: mark complete ───────────────────────────────────────────────
  const t4 = Date.now();
  const completeRes = post(`/orders/${orderId}/complete`, null, farmerToken);
  completeLatency.add(Date.now() - t4);
  const completeOk = check(completeRes, {
    'complete 200': (r) => r.status === 200 || r.status === 204,
  });

  if (completeOk) {
    completedOrders.add(1);
  }

  lifecycleLatency.add(Date.now() - lifecycleStart);
  sleep(1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const p = (key) => m[key]?.values?.['p(95)']?.toFixed(0) ?? 'n/a';
  const lines = [
    '─── Order Lifecycle Summary ───────────────────────',
    `  Place p95:       ${p('order_place_latency_ms')}ms`,
    `  Confirm p95:     ${p('order_confirm_latency_ms')}ms (blockchain)`,
    `  Transit p95:     ${p('order_transit_latency_ms')}ms (blockchain)`,
    `  Deliver p95:     ${p('order_deliver_latency_ms')}ms (blockchain)`,
    `  Complete p95:    ${p('order_complete_latency_ms')}ms (blockchain)`,
    `  Full cycle p95:  ${p('order_full_lifecycle_ms')}ms`,
    `  Completed orders:${m.orders_completed?.values?.count ?? 0}`,
    `  Error rate:      ${((m.order_error_rate?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    '────────────────────────────────────────────────────',
  ];
  console.log(lines.join('\n'));
  return { 'tests/load/results-orders.json': JSON.stringify(data, null, 2) };
}
