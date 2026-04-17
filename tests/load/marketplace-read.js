/**
 * k6 load test — Marketplace read-heavy scenario
 *
 * Simulates buyers browsing the marketplace: paginated listing queries,
 * search, category filters, organic filters, and individual listing fetches.
 * This is the highest-traffic path in production (reads >> writes).
 *
 * Run:  k6 run tests/load/marketplace-read.js -e BASE_URL=http://localhost:8080
 */

import http              from 'k6/http';
import { check, sleep }  from 'k6';
import { Rate, Trend }   from 'k6/metrics';

const errorRate       = new Rate('marketplace_error_rate');
const searchLatency   = new Trend('marketplace_search_latency_ms');
const detailLatency   = new Trend('marketplace_detail_latency_ms');

export const options = {
  scenarios: {
    // Sustained read load — simulates real browse traffic
    browse: {
      executor:    'constant-vus',
      vus:         100,
      duration:    '3m',
    },
    // Spike: flash sale or morning peak
    spike: {
      executor:    'ramping-vus',
      startVUs:    0,
      stages: [
        { duration: '10s', target: 300 },
        { duration: '20s', target: 300 },
        { duration: '10s', target: 0   },
      ],
      startTime: '3m30s',
    },
  },
  thresholds: {
    'marketplace_search_latency_ms':  ['p(95)<400', 'p(99)<800'],
    'marketplace_detail_latency_ms':  ['p(95)<300', 'p(99)<600'],
    'marketplace_error_rate':         ['rate<0.01'],
    'http_req_failed':                ['rate<0.01'],
  },
};

const BASE_URL   = __ENV.BASE_URL || 'http://localhost:8080';
const API        = `${BASE_URL}/api/v1`;

const CATEGORIES = ['grains', 'vegetables', 'fruits', 'dairy', 'spices', 'pulses'];
const SEARCH_TERMS = ['basmati', 'wheat', 'tomato', 'mango', 'rice', 'organic'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jsonGet(url) {
  return http.get(url, { headers: { 'Content-Type': 'application/json' } });
}

// Cache listing IDs from first page load to use in detail requests
const listingIds = [];

export default function () {
  // ── 1. Browse first page ──────────────────────────────────────────────────
  const t0 = Date.now();
  const browseRes = jsonGet(`${API}/listings?page=1&limit=20`);
  searchLatency.add(Date.now() - t0);

  const browseOk = check(browseRes, {
    'browse 200':      (r) => r.status === 200,
    'has listings':    (r) => Array.isArray(r.json('listings') || r.json('data')),
  });
  errorRate.add(!browseOk);

  // Collect IDs for detail requests
  if (browseOk) {
    const items = browseRes.json('listings') || browseRes.json('data') || [];
    items.forEach(l => { if (l.id && listingIds.length < 100) listingIds.push(l.id); });
  }

  sleep(0.5);

  // ── 2. Category filter ────────────────────────────────────────────────────
  const category = randomItem(CATEGORIES);
  const t1 = Date.now();
  const catRes = jsonGet(`${API}/listings?category=${category}&limit=20`);
  searchLatency.add(Date.now() - t1);
  check(catRes, { 'category filter 200': (r) => r.status === 200 });

  sleep(0.3);

  // ── 3. Search query ───────────────────────────────────────────────────────
  const term = randomItem(SEARCH_TERMS);
  const t2 = Date.now();
  const searchRes = jsonGet(`${API}/listings?search=${encodeURIComponent(term)}&limit=20`);
  searchLatency.add(Date.now() - t2);
  check(searchRes, { 'search 200': (r) => r.status === 200 });

  sleep(0.3);

  // ── 4. Organic filter ─────────────────────────────────────────────────────
  const t3 = Date.now();
  const organicRes = jsonGet(`${API}/listings?is_organic=true&limit=20`);
  searchLatency.add(Date.now() - t3);
  check(organicRes, { 'organic filter 200': (r) => r.status === 200 });

  sleep(0.2);

  // ── 5. Listing detail ─────────────────────────────────────────────────────
  if (listingIds.length > 0) {
    const id = listingIds[Math.floor(Math.random() * listingIds.length)];
    const t4 = Date.now();
    const detailRes = jsonGet(`${API}/listings/${id}`);
    detailLatency.add(Date.now() - t4);
    check(detailRes, {
      'detail 200':        (r) => r.status === 200,
      'has price':         (r) => !!(r.json('price_per_unit') || r.json('pricePerUnit')),
    });
  }

  sleep(1 + Math.random());   // 1–2s think time between page views
}

export function handleSummary(data) {
  const m = data.metrics;
  const lines = [
    '─── Marketplace Read Summary ──────────────────────',
    `  Search p95:    ${m.marketplace_search_latency_ms?.values?.['p(95)']?.toFixed(1) ?? 'n/a'}ms`,
    `  Detail p95:    ${m.marketplace_detail_latency_ms?.values?.['p(95)']?.toFixed(1) ?? 'n/a'}ms`,
    `  Error rate:    ${((m.marketplace_error_rate?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    `  Total reqs:    ${m.http_reqs?.values?.count ?? 0}`,
    '────────────────────────────────────────────────────',
  ];
  console.log(lines.join('\n'));
  return { 'tests/load/results-marketplace.json': JSON.stringify(data, null, 2) };
}
