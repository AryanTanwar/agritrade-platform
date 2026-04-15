'use strict';

/**
 * shared/fabric-client.js — AgriTrade Hyperledger Fabric SDK Gateway wrapper.
 *
 * Wraps fabric-network v2.x to provide:
 *  - Singleton gateway per identity (connection pooling)
 *  - Automatic retry with exponential back-off for transient errors
 *  - Structured logging via the shared Winston logger
 *  - Prometheus metrics: txn latency, submit/evaluate counts, errors
 *  - Chaincode event listener management
 *  - X.509 identity enrollment via Fabric CA
 *
 * Usage:
 *   const fabric = require('../shared/fabric-client');
 *   await fabric.init();
 *   const result = await fabric.evaluateTransaction('agritrade-channel', 'trade', 'GetListing', 'listing-001');
 */

const path       = require('path');
const fs         = require('fs');
const { Gateway, Wallets, DefaultEventHandlerStrategies, DefaultQueryHandlerStrategies } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');

const logger = require('./logger');

// ── Configuration ─────────────────────────────────────────────────────────────

const FABRIC_CONFIG = {
  channelName:   process.env.FABRIC_CHANNEL_NAME   || 'agritrade-channel',
  walletPath:    process.env.FABRIC_WALLET_PATH    || path.join(process.cwd(), 'wallet'),
  connectionProfilePath: process.env.FABRIC_CONNECTION_PROFILE
                         || path.join(__dirname, '..', 'fabric', 'connection-profile.json'),
  // Identity used by the Node.js gateway (gateway identity must already be enrolled)
  gatewayIdentity: process.env.FABRIC_GATEWAY_IDENTITY || 'appUser',
  // Timeouts
  submitTimeoutMs:   parseInt(process.env.FABRIC_SUBMIT_TIMEOUT_MS,   10) || 30_000,
  evaluateTimeoutMs: parseInt(process.env.FABRIC_EVALUATE_TIMEOUT_MS, 10) || 10_000,
  // Retry settings for submit transactions
  retryAttempts: parseInt(process.env.FABRIC_RETRY_ATTEMPTS, 10) || 3,
  retryBaseMs:   parseInt(process.env.FABRIC_RETRY_BASE_MS,   10) || 500,
};

// ── Singleton state ───────────────────────────────────────────────────────────

/** @type {Map<string, Gateway>} identity → connected Gateway */
const gateways = new Map();

/** @type {Map<string, import('fabric-network').Network>} channelName → Network */
const networks = new Map();

/** @type {Map<string, import('fabric-network').ContractListener>} event key → listener */
const eventListeners = new Map();

let wallet = null;
let connectionProfile = null;
let initialised = false;

// ── Prometheus metrics (optional — skips gracefully if prom-client absent) ───

let metrics = null;
try {
  const promClient = require('prom-client');
  metrics = {
    txnDuration: new promClient.Histogram({
      name: 'fabric_txn_duration_seconds',
      help: 'Fabric transaction duration in seconds',
      labelNames: ['channel', 'chaincode', 'function', 'type'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    txnTotal: new promClient.Counter({
      name: 'fabric_txn_total',
      help: 'Total Fabric transactions',
      labelNames: ['channel', 'chaincode', 'function', 'type', 'status'],
    }),
    errorTotal: new promClient.Counter({
      name: 'fabric_error_total',
      help: 'Total Fabric transaction errors',
      labelNames: ['channel', 'chaincode', 'function', 'errorCode'],
    }),
  };
} catch {
  // prom-client not installed — metrics disabled
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sleep for `ms` milliseconds.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns true for errors that are worth retrying (network/timeout only).
 * @param {Error} err
 */
function isRetryable(err) {
  const msg = err.message || '';
  return (
    msg.includes('UNAVAILABLE')    ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('Connection reset') ||
    msg.includes('ECONNRESET')     ||
    msg.includes('ETIMEDOUT')
  );
}

/**
 * Parse a chaincode error message into a structured object.
 * Fabric returns errors prefixed with the error code, e.g. "[NOT_FOUND] order '...' not found".
 * @param {Error} err
 * @returns {{ code: string, message: string }}
 */
function parseChaincodeError(err) {
  const raw = err.message || String(err);
  const match = raw.match(/\[([A-Z_]+)\]\s*(.*)/);
  if (match) {
    return { code: match[1], message: match[2] };
  }
  return { code: 'CHAINCODE_ERROR', message: raw };
}

/**
 * Record metrics for a completed transaction.
 */
function recordMetric(labels, durationSecs, status) {
  if (!metrics) return;
  metrics.txnDuration.observe(labels, durationSecs);
  metrics.txnTotal.inc({ ...labels, status });
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Initialise the Fabric client. Must be called once before any transaction.
 * Idempotent — safe to call multiple times.
 */
async function init() {
  if (initialised) return;

  // Load connection profile
  if (!fs.existsSync(FABRIC_CONFIG.connectionProfilePath)) {
    throw new Error(
      `Fabric connection profile not found at: ${FABRIC_CONFIG.connectionProfilePath}`
    );
  }
  const raw = fs.readFileSync(FABRIC_CONFIG.connectionProfilePath, 'utf8');
  connectionProfile = JSON.parse(raw);
  logger.info('[fabric-client] Connection profile loaded', {
    name: connectionProfile.name || 'unknown',
    version: connectionProfile.version || 'unknown',
  });

  // Create wallet
  fs.mkdirSync(FABRIC_CONFIG.walletPath, { recursive: true });
  wallet = await Wallets.newFileSystemWallet(FABRIC_CONFIG.walletPath);
  logger.info('[fabric-client] Wallet initialised', { path: FABRIC_CONFIG.walletPath });

  initialised = true;
}

// ── Gateway management ────────────────────────────────────────────────────────

/**
 * Returns a connected Gateway for the given identity label.
 * Creates a new one if it doesn't exist or has been disconnected.
 * @param {string} identityLabel
 * @returns {Promise<Gateway>}
 */
async function getGateway(identityLabel = FABRIC_CONFIG.gatewayIdentity) {
  if (!initialised) await init();

  if (gateways.has(identityLabel)) {
    return gateways.get(identityLabel);
  }

  const identity = await wallet.get(identityLabel);
  if (!identity) {
    throw new Error(
      `Identity '${identityLabel}' not found in wallet. Enroll the user first via enrollUser().`
    );
  }

  const gateway = new Gateway();
  await gateway.connect(connectionProfile, {
    wallet,
    identity: identityLabel,
    discovery: {
      enabled: true,
      asLocalhost: process.env.NODE_ENV !== 'production',
    },
    eventHandlerOptions: {
      strategy: DefaultEventHandlerStrategies.PREFER_MSPID_SCOPE_ALLFORTX,
      commitTimeout: FABRIC_CONFIG.submitTimeoutMs / 1000,
    },
    queryHandlerOptions: {
      strategy:      DefaultQueryHandlerStrategies.PREFER_MSPID_SCOPE_ROUND_ROBIN,
      timeout:       FABRIC_CONFIG.evaluateTimeoutMs / 1000,
    },
  });

  gateways.set(identityLabel, gateway);
  logger.info('[fabric-client] Gateway connected', { identity: identityLabel });

  return gateway;
}

/**
 * Returns the Network (channel handle) for the given identity.
 * @param {string} channelName
 * @param {string} identityLabel
 * @returns {Promise<import('fabric-network').Network>}
 */
async function getNetwork(channelName, identityLabel = FABRIC_CONFIG.gatewayIdentity) {
  const cacheKey = `${identityLabel}::${channelName}`;
  if (networks.has(cacheKey)) {
    return networks.get(cacheKey);
  }

  const gateway = await getGateway(identityLabel);
  const network  = await gateway.getNetwork(channelName);
  networks.set(cacheKey, network);
  return network;
}

/**
 * Returns the Contract handle for the given channel and chaincode.
 * @param {string} channelName
 * @param {string} chaincodeName
 * @param {string} [identityLabel]
 * @returns {Promise<import('fabric-network').Contract>}
 */
async function getContract(channelName, chaincodeName, identityLabel) {
  const network = await getNetwork(channelName, identityLabel);
  return network.getContract(chaincodeName);
}

// ── Transactions ──────────────────────────────────────────────────────────────

/**
 * Submit a transaction (write — goes through consensus and ordering).
 *
 * @param {string}   channelName
 * @param {string}   chaincodeName
 * @param {string}   fcn           - chaincode function name
 * @param {...string} args          - string arguments
 * @param {object}   [options]
 * @param {string}   [options.identityLabel]
 * @param {object}   [options.transientData]  - key/Buffer map for private data
 * @returns {Promise<object>}       - parsed JSON response
 */
async function submitTransaction(channelName, chaincodeName, fcn, ...rest) {
  // Last arg may be options object
  let args = rest;
  let options = {};
  if (rest.length > 0 && typeof rest[rest.length - 1] === 'object' && !Array.isArray(rest[rest.length - 1])) {
    options = rest[rest.length - 1];
    args = rest.slice(0, -1);
  }

  const { identityLabel, transientData } = options;
  const metricLabels = { channel: channelName, chaincode: chaincodeName, function: fcn, type: 'submit' };

  let lastError;
  for (let attempt = 1; attempt <= FABRIC_CONFIG.retryAttempts; attempt++) {
    const t0 = Date.now();
    try {
      const contract = await getContract(channelName, chaincodeName, identityLabel);

      let txn = contract.createTransaction(fcn);
      if (transientData) {
        // Convert plain strings to Buffers for transient data
        const bufMap = {};
        for (const [k, v] of Object.entries(transientData)) {
          bufMap[k] = Buffer.from(typeof v === 'string' ? v : JSON.stringify(v));
        }
        txn = txn.setTransient(bufMap);
      }

      const result = await txn.submit(...args.map(String));

      const durationSecs = (Date.now() - t0) / 1000;
      recordMetric(metricLabels, durationSecs, 'success');
      logger.info('[fabric-client] Transaction submitted', {
        channel:   channelName,
        chaincode: chaincodeName,
        function:  fcn,
        txId:      txn.getTransactionId(),
        durationMs: Math.round(durationSecs * 1000),
        attempt,
      });

      return result.length > 0 ? JSON.parse(result.toString()) : null;

    } catch (err) {
      const durationSecs = (Date.now() - t0) / 1000;
      lastError = err;

      const parsed = parseChaincodeError(err);
      logger.warn('[fabric-client] Transaction failed', {
        channel:   channelName,
        chaincode: chaincodeName,
        function:  fcn,
        errorCode: parsed.code,
        message:   parsed.message,
        attempt,
        willRetry: attempt < FABRIC_CONFIG.retryAttempts && isRetryable(err),
      });

      if (metrics) {
        metrics.errorTotal.inc({ ...metricLabels, errorCode: parsed.code });
      }
      recordMetric(metricLabels, durationSecs, 'error');

      // Remove cached gateway on connection failure so it is recreated
      if (isRetryable(err)) {
        if (attempt < FABRIC_CONFIG.retryAttempts) {
          const backoffMs = FABRIC_CONFIG.retryBaseMs * Math.pow(2, attempt - 1);
          await sleep(backoffMs);
          // Invalidate stale gateway
          const gw = gateways.get(identityLabel || FABRIC_CONFIG.gatewayIdentity);
          if (gw) {
            try { gw.disconnect(); } catch { /* ignore */ }
          }
          gateways.delete(identityLabel || FABRIC_CONFIG.gatewayIdentity);
          networks.delete(`${identityLabel || FABRIC_CONFIG.gatewayIdentity}::${channelName}`);
          continue;
        }
      } else {
        // Non-retryable chaincode error — throw immediately with enriched error
        const enriched = new Error(parsed.message);
        enriched.code = parsed.code;
        enriched.chaincodeName = chaincodeName;
        enriched.function = fcn;
        throw enriched;
      }
    }
  }

  const enriched = new Error(`Fabric submit failed after ${FABRIC_CONFIG.retryAttempts} attempts: ${lastError.message}`);
  enriched.code = 'FABRIC_TIMEOUT';
  throw enriched;
}

/**
 * Evaluate a transaction (read-only — does not go through ordering).
 *
 * @param {string}   channelName
 * @param {string}   chaincodeName
 * @param {string}   fcn
 * @param {...string} args
 * @param {object}   [options]
 * @param {string}   [options.identityLabel]
 * @returns {Promise<object>}
 */
async function evaluateTransaction(channelName, chaincodeName, fcn, ...rest) {
  let args = rest;
  let options = {};
  if (rest.length > 0 && typeof rest[rest.length - 1] === 'object' && !Array.isArray(rest[rest.length - 1])) {
    options = rest[rest.length - 1];
    args = rest.slice(0, -1);
  }

  const { identityLabel } = options;
  const metricLabels = { channel: channelName, chaincode: chaincodeName, function: fcn, type: 'evaluate' };
  const t0 = Date.now();

  try {
    const contract = await getContract(channelName, chaincodeName, identityLabel);
    const result   = await contract.evaluateTransaction(fcn, ...args.map(String));

    const durationSecs = (Date.now() - t0) / 1000;
    recordMetric(metricLabels, durationSecs, 'success');
    logger.debug('[fabric-client] Transaction evaluated', {
      channel: channelName, chaincode: chaincodeName, function: fcn,
      durationMs: Math.round(durationSecs * 1000),
    });

    return result.length > 0 ? JSON.parse(result.toString()) : null;

  } catch (err) {
    const durationSecs = (Date.now() - t0) / 1000;
    const parsed = parseChaincodeError(err);

    if (metrics) metrics.errorTotal.inc({ ...metricLabels, errorCode: parsed.code });
    recordMetric(metricLabels, durationSecs, 'error');

    logger.error('[fabric-client] Evaluate failed', {
      channel: channelName, chaincode: chaincodeName, function: fcn,
      errorCode: parsed.code, message: parsed.message,
    });

    const enriched = new Error(parsed.message);
    enriched.code  = parsed.code;
    throw enriched;
  }
}

// ── Chaincode event listeners ─────────────────────────────────────────────────

/**
 * Subscribe to chaincode events.
 *
 * @param {string}   channelName
 * @param {string}   chaincodeName
 * @param {string}   eventName      - glob pattern or exact name (e.g. 'OrderPlaced')
 * @param {function} handler        - async (event: ChaincodeEvent) => void
 * @param {object}   [options]
 * @param {string}   [options.identityLabel]
 * @param {number}   [options.startBlock]      - replay from block number
 * @returns {Promise<string>} listenerKey  — pass to removeEventListener()
 */
async function addEventHandler(channelName, chaincodeName, eventName, handler, options = {}) {
  const { identityLabel, startBlock } = options;
  const network = await getNetwork(channelName, identityLabel);
  const contract = network.getContract(chaincodeName);

  const listenerOptions = startBlock != null ? { startBlock: BigInt(startBlock) } : {};

  const listener = async (event) => {
    try {
      const payload = event.payload ? JSON.parse(event.payload.toString()) : null;
      logger.debug('[fabric-client] Chaincode event received', {
        eventName: event.eventName,
        txId:      event.transactionId,
        blockNum:  event.blockNumber?.toString(),
      });
      await handler({ ...event, payload });
    } catch (err) {
      logger.error('[fabric-client] Event handler error', { eventName, error: err.message });
    }
  };

  await contract.addContractListener(listener, listenerOptions);

  const key = `${channelName}::${chaincodeName}::${eventName}::${Date.now()}`;
  eventListeners.set(key, { contract, listener });
  logger.info('[fabric-client] Event listener registered', { channelName, chaincodeName, eventName });
  return key;
}

/**
 * Remove a previously registered event listener.
 * @param {string} listenerKey
 */
async function removeEventHandler(listenerKey) {
  const entry = eventListeners.get(listenerKey);
  if (!entry) return;
  entry.contract.removeContractListener(entry.listener);
  eventListeners.delete(listenerKey);
  logger.info('[fabric-client] Event listener removed', { listenerKey });
}

// ── Identity / CA management ──────────────────────────────────────────────────

/**
 * Enroll the CA admin and persist the identity to the wallet.
 * Only needed once per CA.
 *
 * @param {object} caConfig
 * @param {string} caConfig.caName        - e.g. 'ca-farmers'
 * @param {string} caConfig.caURL         - e.g. 'https://ca.farmers.agritrade.com:7054'
 * @param {string} caConfig.tlsCACert     - PEM string of the CA TLS cert
 * @param {string} caConfig.adminId
 * @param {string} caConfig.adminSecret
 * @param {string} caConfig.mspId         - e.g. 'FarmersMSP'
 */
async function enrollAdmin(caConfig) {
  if (!initialised) await init();

  const { caName, caURL, tlsCACert, adminId, adminSecret, mspId } = caConfig;

  if (await wallet.get(adminId)) {
    logger.info('[fabric-client] Admin already enrolled', { adminId });
    return;
  }

  const ca = new FabricCAServices(caURL, { trustedRoots: tlsCACert, verify: true }, caName);
  const enrollment = await ca.enroll({ enrollmentID: adminId, enrollmentSecret: adminSecret });

  const identity = {
    credentials: {
      certificate: enrollment.certificate,
      privateKey:  enrollment.key.toBytes(),
    },
    mspId,
    type: 'X.509',
  };

  await wallet.put(adminId, identity);
  logger.info('[fabric-client] Admin enrolled and stored in wallet', { adminId, mspId });
}

/**
 * Register and enroll a new application user.
 *
 * @param {object} opts
 * @param {string} opts.caName
 * @param {string} opts.caURL
 * @param {string} opts.tlsCACert
 * @param {string} opts.adminId       - wallet label of the registered admin
 * @param {string} opts.userId        - new user's wallet label
 * @param {string} opts.affiliation   - e.g. 'farmers.cooperative'
 * @param {string} opts.mspId
 * @param {object} [opts.attrs]       - custom attributes (role, etc.)
 */
async function enrollUser(opts) {
  if (!initialised) await init();

  const { caName, caURL, tlsCACert, adminId, userId, affiliation, mspId, attrs } = opts;

  if (await wallet.get(userId)) {
    logger.info('[fabric-client] User already enrolled', { userId });
    return;
  }

  const adminIdentity = await wallet.get(adminId);
  if (!adminIdentity) {
    throw new Error(`Admin identity '${adminId}' not found in wallet. Run enrollAdmin() first.`);
  }

  const ca      = new FabricCAServices(caURL, { trustedRoots: tlsCACert, verify: true }, caName);
  const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
  const adminUser = await provider.getUserContext(adminIdentity, adminId);

  const secret = await ca.register({
    affiliation,
    enrollmentID: userId,
    role: 'client',
    attrs: attrs ? Object.entries(attrs).map(([name, value]) => ({ name, value, ecert: true })) : [],
  }, adminUser);

  const enrollment = await ca.enroll({ enrollmentID: userId, enrollmentSecret: secret });

  const identity = {
    credentials: {
      certificate: enrollment.certificate,
      privateKey:  enrollment.key.toBytes(),
    },
    mspId,
    type: 'X.509',
  };

  await wallet.put(userId, identity);
  logger.info('[fabric-client] User enrolled and stored in wallet', { userId, mspId, affiliation });
}

// ── Health check ──────────────────────────────────────────────────────────────

/**
 * Check Fabric connectivity by evaluating a lightweight query.
 * Returns { status: 'ok' } or throws.
 */
async function healthCheck() {
  try {
    // A simple peer ping via any evaluate call; we use GetChainInfo if available
    const gateway = await getGateway();
    const network = await gateway.getNetwork(FABRIC_CONFIG.channelName);
    // Just getting the network object confirms peer connectivity
    if (!network) throw new Error('No network');
    return { status: 'ok', channel: FABRIC_CONFIG.channelName };
  } catch (err) {
    throw new Error(`Fabric health check failed: ${err.message}`);
  }
}

// ── Graceful disconnect ───────────────────────────────────────────────────────

/**
 * Disconnect all gateways and clear state. Call on process shutdown.
 */
async function disconnect() {
  for (const [label, gateway] of gateways.entries()) {
    try {
      gateway.disconnect();
      logger.info('[fabric-client] Gateway disconnected', { identity: label });
    } catch { /* ignore */ }
  }
  gateways.clear();
  networks.clear();
  eventListeners.clear();
  initialised = false;
}

// Register disconnect on graceful shutdown signals
process.once('SIGTERM', disconnect);
process.once('SIGINT',  disconnect);

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  init,
  // Transaction API
  submitTransaction,
  evaluateTransaction,
  // Event API
  addEventHandler,
  removeEventHandler,
  // Identity management
  enrollAdmin,
  enrollUser,
  // Utility
  healthCheck,
  disconnect,
  // Config (read-only export for testing)
  get config() { return { ...FABRIC_CONFIG }; },
  // Wallet (for advanced usage)
  get wallet() { return wallet; },
};
