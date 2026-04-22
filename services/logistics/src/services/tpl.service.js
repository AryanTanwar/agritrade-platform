'use strict';

const crypto = require('crypto');
const axios  = require('axios');
const db     = require('../../../../shared/db');
const logger = require('../../../../shared/logger');
const { ValidationError } = require('../../../../shared/error-handler');

// ─── Provider registry ────────────────────────────────────────────────────────
// Add more 3PL providers here as needed
const PROVIDER_CONFIG = {
  delhivery: {
    secret: process.env.DELHIVERY_WEBHOOK_SECRET,
    sigHeader: 'x-delhivery-signature',
    verifyFn: _verifyHmacSha256,
  },
  shiprocket: {
    secret: process.env.SHIPROCKET_WEBHOOK_SECRET,
    sigHeader: 'x-shiprocket-signature',
    verifyFn: _verifyHmacSha256,
  },
  bluedart: {
    secret: process.env.BLUEDART_WEBHOOK_SECRET,
    sigHeader: 'x-bluedart-token',
    verifyFn: _verifyStaticToken,
  },
};

// ─── Webhook ingestion ────────────────────────────────────────────────────────

async function handleWebhook(provider, headers, body) {
  const config = PROVIDER_CONFIG[provider.toLowerCase()];
  if (!config) {
    logger.warn({ event: 'tpl_unknown_provider', provider });
    return; // Silently accept unknown providers to avoid enumeration
  }

  // Verify signature when secret is configured
  if (config.secret) {
    config.verifyFn(headers, body, config);
  }

  const event = typeof body === 'string' ? JSON.parse(body) : body;
  logger.info({ event: 'tpl_webhook_received', provider, type: event.status || event.event });

  const mapped = _normaliseEvent(provider, event);
  if (mapped) {
    await _applyTrackingUpdate(mapped);
  }
}

// ─── Signature helpers ────────────────────────────────────────────────────────

function _verifyHmacSha256(headers, body, { sigHeader, secret }) {
  const sig = headers[sigHeader];
  if (!sig) throw new ValidationError(`Missing webhook signature header: ${sigHeader}`);

  const payload  = typeof body === 'string' ? body : JSON.stringify(body);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))) {
    throw new ValidationError(`${sigHeader} signature mismatch`);
  }
}

function _verifyStaticToken(headers, body, { sigHeader, secret }) {
  const token = headers[sigHeader];
  if (!token || token !== secret) throw new ValidationError('Invalid webhook token');
}

// ─── Event normalisation ──────────────────────────────────────────────────────

/**
 * Map provider-specific payloads to a common shape:
 * { thirdPartyRef, status, location?, timestamp }
 */
function _normaliseEvent(provider, event) {
  switch (provider.toLowerCase()) {
    case 'delhivery': {
      // Delhivery sends a shipment_data array
      const pkg = event.shipment_data?.[0]?.shipment;
      if (!pkg) return null;
      return {
        thirdPartyRef: pkg.waybill,
        status:        _mapDelhiveryStatus(pkg.status),
        location:      pkg.scans?.[0]?.['scan-location'] || null,
        timestamp:     pkg.expected_date || new Date().toISOString(),
      };
    }

    case 'shiprocket': {
      return {
        thirdPartyRef: event.awb_code || event.order_id,
        status:        _mapShiprocketStatus(event.current_status),
        location:      event.current_location || null,
        timestamp:     event.updated_at || new Date().toISOString(),
      };
    }

    default:
      return null;
  }
}

function _mapDelhiveryStatus(s = '') {
  const lower = s.toLowerCase();
  if (lower.includes('delivered'))            return 'delivered';
  if (lower.includes('out for delivery'))     return 'out_for_delivery';
  if (lower.includes('in transit'))           return 'in_transit';
  if (lower.includes('picked up'))            return 'picked_up';
  if (lower.includes('damaged'))              return 'damaged';
  return null;
}

function _mapShiprocketStatus(s = '') {
  const map = {
    'delivered':         'delivered',
    'out for delivery':  'out_for_delivery',
    'in transit':        'in_transit',
    'picked up':         'picked_up',
    'damaged':           'damaged',
  };
  return map[s.toLowerCase()] || null;
}

// ─── Apply tracking update to DB ──────────────────────────────────────────────

async function _applyTrackingUpdate({ thirdPartyRef, status, location }) {
  if (!thirdPartyRef || !status) return;

  const result = await db.query(
    "SELECT id FROM shipments WHERE third_party_ref = $1 AND status NOT IN ('delivered','damaged','returned')",
    [thirdPartyRef]
  );
  if (!result.rows.length) return;

  const shipmentId = result.rows[0].id;

  await db.query(
    'UPDATE shipments SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, shipmentId]
  );

  if (location) {
    logger.info({ event: 'tpl_location_update', shipmentId, location, status });
  }

  logger.info({ event: 'tpl_status_applied', shipmentId, thirdPartyRef, status });
}

// ─── Outbound 3PL API calls ───────────────────────────────────────────────────

/**
 * Book a shipment with Delhivery.
 * Used by shipment.service.create() for DELHIVERY cargo type.
 */
async function bookDelhivery(shipmentData) {
  const token = process.env.DELHIVERY_API_TOKEN;
  if (!token) throw new Error('DELHIVERY_API_TOKEN not configured');

  const response = await axios.post(
    'https://track.delhivery.com/api/cmu/create.json',
    shipmentData,
    {
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    }
  );
  return response.data;
}

module.exports = { handleWebhook, bookDelhivery };
