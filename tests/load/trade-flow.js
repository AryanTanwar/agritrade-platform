import http    from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Custom metrics ───────────────────────────────────────────────────────────
const errorRate      = new Rate('error_rate');
const loginDuration  = new Trend('login_duration');
const listingDuration = new Trend('listing_duration');
const orderDuration  = new Trend('order_duration');

// ─── Test configuration ───────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10  },   // ramp up
    { duration: '1m',  target: 50  },   // steady load
    { duration: '30s', target: 100 },   // peak load
    { duration: '30s', target: 0   },   // ramp down
  ],
  thresholds: {
    http_req_duration:   ['p(95)<500'],   // 95% of requests under 500ms
    http_req_failed:     ['rate<0.01'],   // Less than 1% failure rate
    error_rate:          ['rate<0.05'],
    login_duration:      ['p(95)<300'],
    listing_duration:    ['p(95)<400'],
    order_duration:      ['p(95)<1000'], // blockchain writes are slower
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// ─── Test data ────────────────────────────────────────────────────────────────
const farmers = [
  { phone: '+919876540001', password: 'TestFarmer@123!' },
  { phone: '+919876540002', password: 'TestFarmer@123!' },
  { phone: '+919876540003', password: 'TestFarmer@123!' },
];

const buyers = [
  { email: 'buyer1@test.agritrade.dev', password: 'TestBuyer@123!' },
  { email: 'buyer2@test.agritrade.dev', password: 'TestBuyer@123!' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function headers(token) {
  return {
    'Content-Type':  'application/json',
    'Authorization': token ? `Bearer ${token}` : undefined,
  };
}

// ─── Main test scenario ───────────────────────────────────────────────────────
export default function () {
  // 1. Health check
  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'health ok': (r) => r.status === 200 });

  sleep(0.2);

  // 2. Farmer login
  const farmer   = randomItem(farmers);
  const loginStart = Date.now();
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ phone: farmer.phone, password: farmer.password }),
    { headers: headers() }
  );
  loginDuration.add(Date.now() - loginStart);
  const loginOk = check(loginRes, {
    'login 200':       (r) => r.status === 200,
    'has token':       (r) => !!r.json('token'),
  });
  errorRate.add(!loginOk);

  const token = loginRes.json('token');
  sleep(0.5);

  // 3. Browse listings
  const listStart  = Date.now();
  const listingsRes = http.get(
    `${BASE_URL}/api/v1/listings?page=1&limit=20&category=grains`,
    { headers: headers(token) }
  );
  listingDuration.add(Date.now() - listStart);
  check(listingsRes, {
    'listings 200': (r) => r.status === 200,
    'has data':     (r) => Array.isArray(r.json('data')),
  });

  sleep(1);

  // 4. Create listing (farmer action)
  const createStart = Date.now();
  const createRes   = http.post(
    `${BASE_URL}/api/v1/listings`,
    JSON.stringify({
      title:         'Premium Basmati Rice',
      category:      'grains',
      quantity:       500,
      unit:           'kg',
      price_per_unit: 85,
      is_organic:     false,
      description:   'Grade A Basmati, pesticide-free',
      location:       { city: 'Amritsar', state: 'Punjab' },
    }),
    { headers: headers(token) }
  );
  orderDuration.add(Date.now() - createStart);
  const listingOk = check(createRes, {
    'listing created 201': (r) => r.status === 201,
  });
  errorRate.add(!listingOk && createRes.status !== 401);

  const listingId = createRes.json('id') || createRes.json('listing')?.id;
  sleep(0.5);

  // 5. Buyer login + place order ─────────────────────────────────────────────
  const buyer      = randomItem(buyers);
  const bLoginRes  = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ phone: buyer.email, password: buyer.password }),
    { headers: headers() }
  );
  const bToken = bLoginRes.json('token');

  if (bToken && listingId) {
    const orderStart = Date.now();
    const orderRes   = http.post(
      `${BASE_URL}/api/v1/orders`,
      JSON.stringify({
        listing_id:       listingId,
        quantity:         5,
        delivery_address: '1 Load Test Road, New Delhi',
        delivery_pincode: '110001',
      }),
      { headers: headers(bToken) }
    );
    orderDuration.add(Date.now() - orderStart);
    check(orderRes, {
      'order placed 201': (r) => r.status === 201 || r.status === 200,
    });
    errorRate.add(orderRes.status >= 500);
  }

  sleep(1);
}

// ─── Setup & teardown ─────────────────────────────────────────────────────────
export function setup() {
  console.log(`Load testing against: ${BASE_URL}`);
  const health = http.get(`${BASE_URL}/health`);
  if (health.status !== 200) {
    throw new Error(`Server not healthy: ${health.status}`);
  }
}

export function handleSummary(data) {
  return {
    'tests/load/results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data) {
  const metrics = data.metrics;
  return [
    '─── k6 Load Test Summary ──────────────────────',
    `  Requests:      ${metrics.http_reqs.values.count}`,
    `  Failed:        ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%`,
    `  p95 latency:   ${metrics.http_req_duration.values['p(95)'].toFixed(1)}ms`,
    `  Error rate:    ${(metrics.error_rate?.values?.rate * 100 || 0).toFixed(2)}%`,
    '───────────────────────────────────────────────',
  ].join('\n');
}
