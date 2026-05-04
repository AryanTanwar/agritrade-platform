-- ─────────────────────────────────────────────────────────────────────────────
-- AgriTrade — PostgreSQL initialisation
-- Runs once on first container start via docker-entrypoint-initdb.d/
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";  -- query monitoring

-- ── Roles (principle of least privilege) ─────────────────────────────────────
-- App role: SELECT/INSERT/UPDATE/DELETE on app tables only — no DDL
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agritrade_app') THEN
    CREATE ROLE agritrade_app LOGIN PASSWORD 'PLACEHOLDER_REPLACED_BY_VAULT';
  END IF;
END$$;

-- Read-only role for analytics / reporting queries
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agritrade_readonly') THEN
    CREATE ROLE agritrade_readonly NOLOGIN;
  END IF;
END$$;

-- ── Schema ────────────────────────────────────────────────────────────────────

-- Users table (farmers, buyers, logistics partners, admins)
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(15)  UNIQUE,
  email           VARCHAR(254) UNIQUE,
  password_hash   TEXT         NOT NULL,
  role            VARCHAR(20)  NOT NULL CHECK (role IN ('farmer','buyer','retailer','wholesaler','logistics','admin')),
  name            TEXT         NOT NULL,
  -- Encrypted PII
  aadhaar_enc     TEXT,        -- AES-256 encrypted Aadhaar last 4
  gst_number      TEXT,
  -- KYC
  kyc_verified    BOOLEAN      NOT NULL DEFAULT FALSE,
  kyc_verified_at TIMESTAMPTZ,
  -- 2FA
  totp_secret_enc TEXT,        -- AES-256 encrypted TOTP secret
  totp_enabled    BOOLEAN      NOT NULL DEFAULT FALSE,
  -- Fabric identity
  msp_id          TEXT,         -- Hyperledger Fabric MSP identifier
  fabric_cert     TEXT,
  -- Location
  district        TEXT,
  state           TEXT,
  pincode         VARCHAR(6),
  address         TEXT,
  -- Buyer-only profile
  business_name   TEXT,
  -- Status
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  is_blocked      BOOLEAN      NOT NULL DEFAULT FALSE,
  blocked_reason  TEXT,
  -- Timestamps
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ              -- soft delete
);

-- Refresh tokens (for JWT rotation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,       -- SHA-256 hash of the raw token
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ,
  device_info  TEXT
);

-- Produce listings
CREATE TABLE IF NOT EXISTS listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id       UUID NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  category        VARCHAR(50) NOT NULL,
  quantity        NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  quantity_available NUMERIC(12,3) NOT NULL,
  unit            VARCHAR(20) NOT NULL,
  price_per_unit  NUMERIC(12,2) NOT NULL CHECK (price_per_unit > 0),
  currency        VARCHAR(3) NOT NULL DEFAULT 'INR',
  harvest_date    DATE NOT NULL,
  expiry_date     DATE NOT NULL CHECK (expiry_date > harvest_date),
  location_lat    NUMERIC(9,6),
  location_lng    NUMERIC(9,6),
  district        TEXT,
  state           TEXT,
  is_organic      BOOLEAN NOT NULL DEFAULT FALSE,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','sold','expired','cancelled')),
  fabric_tx_id    TEXT,        -- on-chain transaction ID
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          UUID NOT NULL REFERENCES listings(id),
  buyer_id            UUID NOT NULL REFERENCES users(id),
  farmer_id           UUID NOT NULL REFERENCES users(id),
  quantity            NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price          NUMERIC(12,2) NOT NULL,
  total_amount        NUMERIC(14,2) NOT NULL,
  currency            VARCHAR(3) NOT NULL DEFAULT 'INR',
  status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending','confirmed','payment_held',
                        'dispatched','delivered','completed',
                        'disputed','cancelled','refunded'
                      )),
  delivery_address    TEXT NOT NULL,
  delivery_pincode    VARCHAR(6) NOT NULL,
  payment_id          TEXT,          -- payment gateway reference
  escrow_held         BOOLEAN NOT NULL DEFAULT FALSE,
  escrow_released_at  TIMESTAMPTZ,
  fabric_tx_id        TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shipments (logistics tracking)
CREATE TABLE IF NOT EXISTS shipments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  logistics_id    UUID REFERENCES users(id),   -- assigned logistics partner
  tpl_ref         TEXT,            -- 3PL provider's tracking reference
  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'pending','assigned','picked_up',
                    'in_transit','out_for_delivery','delivered','failed'
                  )),
  current_lat     NUMERIC(9,6),
  current_lng     NUMERIC(9,6),
  temperature_c   NUMERIC(5,2),    -- IoT sensor reading
  humidity_pct    NUMERIC(5,2),
  fabric_tx_id    TEXT,
  estimated_delivery TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log (immutable event history — no UPDATE or DELETE)
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  event       TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_phone         ON users(phone) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_listings_farmer     ON listings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_listings_category   ON listings(category, status);
CREATE INDEX IF NOT EXISTS idx_listings_location   ON listings(state, district);
CREATE INDEX IF NOT EXISTS idx_orders_buyer        ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_farmer       ON orders(farmer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_shipments_order     ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_event    ON audit_log(user_id, event, created_at);

-- ── Triggers: auto-update updated_at ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','listings','orders','shipments']
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at ON %I;
      CREATE TRIGGER trg_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t);
  END LOOP;
END$$;

-- ── Row Level Security (RLS) ──────────────────────────────────────────────────
ALTER TABLE users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders   ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own row
CREATE POLICY users_own_row ON users
  USING (id = current_setting('app.current_user_id', TRUE)::UUID);

-- ── Grant permissions to app role ─────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON users, listings, orders, shipments TO agritrade_app;
GRANT INSERT ON audit_log TO agritrade_app;          -- append-only for app
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO agritrade_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agritrade_readonly;
