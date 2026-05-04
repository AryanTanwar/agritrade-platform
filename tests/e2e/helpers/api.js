'use strict';

/**
 * Lightweight API helper used by Playwright tests to seed / tear down data
 * without going through the browser UI.  All calls target the API gateway
 * directly so tests stay fast and deterministic.
 */

const API_URL = process.env.API_URL || 'http://localhost:8080';
const API_V1  = `${API_URL}/api/v1`;

// ─── Counter for unique test phone numbers ────────────────────────────────────
let _seq = Date.now();
function seq() { return ++_seq; }

// ─── Raw fetch wrapper ────────────────────────────────────────────────────────
async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_V1}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(`API ${method} ${path} → ${res.status}`), { status: res.status, body: json });
  }
  return json;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Register a farmer and return { token, refreshToken, user }.
 * OTP is bypassed by using the test-mode OTP "000000" (only available in
 * NODE_ENV=test / integration environments).
 */
async function registerFarmer(overrides = {}) {
  const phone = overrides.phone ?? `+9198765${String(seq()).slice(-5)}`;
  const password = overrides.password ?? 'TestFarmer@123!';
  const name = overrides.name ?? `Test Farmer ${seq()}`;

  await api('POST', '/auth/register/farmer', {
    phone, password, name,
    // Required per shared/validators/index.js registerFarmer schema:
    district: overrides.district ?? 'Amritsar',
    state:    overrides.state    ?? 'Punjab',
    pincode:  overrides.pincode  ?? '143001',
  });
  // Send & verify OTP (test env returns 000000)
  await api('POST', '/auth/otp/send', { phone });
  await api('POST', '/auth/otp/verify', { phone, otp: '000000' });
  const { token, refreshToken, user } = await api('POST', '/auth/login', { phone, password });
  return { token, refreshToken, user, phone, password };
}

/**
 * Register a buyer and return { token, refreshToken, user }.
 */
async function registerBuyer(overrides = {}) {
  const n = seq();
  const email = overrides.email ?? `buyer${n}@test.agritrade.dev`;
  const phone = overrides.phone ?? `+9187654${String(n).slice(-5)}`;
  const password = overrides.password ?? 'TestBuyer@123!';
  const name = overrides.name ?? `Test Buyer ${n}`;

  await api('POST', '/auth/register/buyer', {
    email, phone, password, name,
    // Required per shared/validators/index.js registerBuyer schema:
    role: overrides.role ?? 'retailer',
  });
  const { token, refreshToken, user } = await api('POST', '/auth/login', { phone, password });
  return { token, refreshToken, user, phone, email, password };
}

// ─── Listing helpers ──────────────────────────────────────────────────────────

async function createListing(farmerToken, overrides = {}) {
  // Per shared/validators/index.js createListing schema (camelCase fields,
  // location must be {lat,lng} coordinates, harvest+expiry dates required).
  const today = new Date();
  const oneMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  return api('POST', '/listings', {
    title:        overrides.title        ?? 'Test Basmati Rice',
    category:     overrides.category     ?? 'grains',
    quantity:     overrides.quantity     ?? 100,
    unit:         overrides.unit         ?? 'kg',
    pricePerUnit: overrides.pricePerUnit ?? 50,
    harvestDate:  overrides.harvestDate  ?? today.toISOString(),
    expiryDate:   overrides.expiryDate   ?? oneMonth.toISOString(),
    description:  overrides.description  ?? 'E2E test listing',
    location:     overrides.location     ?? { lat: 31.6340, lng: 74.8723 }, // Amritsar
  }, farmerToken);
}

// ─── Order helpers ────────────────────────────────────────────────────────────

async function placeOrder(buyerToken, listingId, overrides = {}) {
  // Per shared/validators/index.js createOrder schema (camelCase).
  return api('POST', '/orders', {
    listingId:        listingId,
    quantity:         overrides.quantity         ?? 10,
    deliveryAddress:  overrides.deliveryAddress  ?? '123 Test Street, Test City, TS',
    deliveryPincode:  overrides.deliveryPincode  ?? '110001',
  }, buyerToken);
}

async function confirmOrder(farmerToken, orderId) {
  return api('POST', `/orders/${orderId}/confirm`, undefined, farmerToken);
}

async function markInTransit(farmerToken, orderId) {
  return api('POST', `/orders/${orderId}/in-transit`, undefined, farmerToken);
}

async function confirmDelivery(buyerToken, orderId) {
  return api('POST', `/orders/${orderId}/deliver`, undefined, buyerToken);
}

async function completeOrder(farmerToken, orderId) {
  return api('POST', `/orders/${orderId}/complete`, undefined, farmerToken);
}

module.exports = {
  API_URL,
  API_V1,
  registerFarmer,
  registerBuyer,
  createListing,
  placeOrder,
  confirmOrder,
  markInTransit,
  confirmDelivery,
  completeOrder,
};
