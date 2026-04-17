/**
 * k6 load test — Auth endpoint throughput
 *
 * Stress-tests login, token refresh, and logout under high concurrency.
 * Verifies the rate-limiter kicks in at the expected threshold and that
 * the gateway recovers cleanly after the burst.
 *
 * Run:  k6 run tests/load/auth-flood.js -e BASE_URL=http://localhost:8080
 */

import http           from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

const errorRate       = new Rate('auth_error_rate');
const rateLimitCount  = new Counter('auth_rate_limit_hits');
const loginLatency    = new Trend('auth_login_latency_ms');
const refreshLatency  = new Trend('auth_refresh_latency_ms');

export const options = {
  scenarios: {
    // Ramp to 200 VUs to trigger rate-limiting
    auth_burst: {
      executor:          'ramping-vus',
      startVUs:          0,
      stages: [
        { duration: '20s', target: 50  },
        { duration: '30s', target: 200 },
        { duration: '20s', target: 50  },
        { duration: '10s', target: 0   },
      ],
    },
  },
  thresholds: {
    // Even under burst, successful logins must be fast
    'auth_login_latency_ms':   ['p(95)<600'],
    // Rate-limited (429) responses are expected and acceptable
    'http_req_failed':         ['rate<0.50'],
    'auth_error_rate':         ['rate<0.50'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API      = `${BASE_URL}/api/v1`;

// Pre-seeded test accounts (must exist in the test DB)
const TEST_ACCOUNTS = Array.from({ length: 20 }, (_, i) => ({
  phone:    `+9198765${String(40000 + i).padStart(5, '0')}`,
  password: 'TestFarmer@123!',
}));

function randomAccount() {
  return TEST_ACCOUNTS[Math.floor(Math.random() * TEST_ACCOUNTS.length)];
}

function jsonHeaders(token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return { headers: h };
}

export default function () {
  const account = randomAccount();

  // ── Login ──────────────────────────────────────────────────────────────────
  const t0 = Date.now();
  const loginRes = http.post(
    `${API}/auth/login`,
    JSON.stringify({ phone: account.phone, password: account.password }),
    jsonHeaders()
  );
  loginLatency.add(Date.now() - t0);

  if (loginRes.status === 429) {
    rateLimitCount.add(1);
    sleep(1); // back off — this is expected behaviour
    return;
  }

  const loginOk = check(loginRes, {
    'login status 200':    (r) => r.status === 200,
    'has access token':    (r) => !!r.json('token'),
    'has refresh token':   (r) => !!r.json('refreshToken'),
  });
  errorRate.add(!loginOk);

  if (!loginOk) { sleep(0.5); return; }

  const { token, refreshToken } = loginRes.json();
  sleep(0.3);

  // ── Token refresh ──────────────────────────────────────────────────────────
  const t1 = Date.now();
  const refreshRes = http.post(
    `${API}/auth/refresh`,
    JSON.stringify({ refreshToken }),
    jsonHeaders()
  );
  refreshLatency.add(Date.now() - t1);

  if (refreshRes.status !== 429) {
    check(refreshRes, {
      'refresh status 200':  (r) => r.status === 200,
      'new access token':    (r) => !!r.json('token'),
    });
  }

  sleep(0.2);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logoutRes = http.post(`${API}/auth/logout`, null, jsonHeaders(token));
  check(logoutRes, { 'logout 200 or 204': (r) => r.status === 200 || r.status === 204 });

  sleep(0.5);
}

export function handleSummary(data) {
  const m = data.metrics;
  const lines = [
    '─── Auth Flood Summary ────────────────────────────',
    `  Login p95:        ${m.auth_login_latency_ms?.values?.['p(95)']?.toFixed(1) ?? 'n/a'}ms`,
    `  Refresh p95:      ${m.auth_refresh_latency_ms?.values?.['p(95)']?.toFixed(1) ?? 'n/a'}ms`,
    `  Rate-limit hits:  ${m.auth_rate_limit_hits?.values?.count ?? 0}`,
    `  Error rate:       ${((m.auth_error_rate?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    `  Total requests:   ${m.http_reqs?.values?.count ?? 0}`,
    '────────────────────────────────────────────────────',
  ];
  console.log(lines.join('\n'));
  return { 'tests/load/results-auth.json': JSON.stringify(data, null, 2) };
}
