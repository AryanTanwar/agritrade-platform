'use strict';

const { v4: uuidv4 }   = require('uuid');
const db               = require('../../../shared/db');
const fabricClient     = require('../../../shared/fabric-client');
const { NotFoundError, ForbiddenError, ValidationError } = require('../../../shared/error-handler');
const logger           = require('../../../shared/logger');

const FABRIC_CHANNEL   = process.env.FABRIC_CHANNEL_NAME || 'agritrade-channel';
const FABRIC_CHAINCODE = 'logistics';

async function _getShipment(shipmentId) {
  const result = await db.query('SELECT * FROM shipments WHERE id = $1', [shipmentId]);
  if (!result.rows.length) throw new NotFoundError(`Shipment ${shipmentId} not found`);
  return result.rows[0];
}

async function create(user, data) {
  const id = uuidv4();

  const ccInput = {
    id,
    orderId:             data.orderId,
    thirdPartyRef:       data.thirdPartyRef || '',
    cargoType:           (data.cargoType || 'DRY').toUpperCase(),
    weightKg:            data.weightKg,
    volumeM3:            data.volumeM3 || 0,
    origin:              data.origin,
    destination:         data.destination,
    tempBreachThreshold: data.tempBreachThreshold || 0,
    estimatedDelivery:   data.estimatedDelivery || '',
  };

  let txID = '';
  try {
    const raw = await fabricClient.submitTransaction(
      FABRIC_CHANNEL, FABRIC_CHAINCODE, 'CreateShipment', JSON.stringify(ccInput)
    );
    txID = JSON.parse(raw.toString()).txID || '';
  } catch (err) {
    logger.error({ event: 'fabric_create_shipment_failed', id, error: err.message });
    throw err;
  }

  const result = await db.query(
    `INSERT INTO shipments
       (id, order_id, provider_id, provider_msp, third_party_ref, cargo_type,
        weight_kg, volume_m3, origin_lat, origin_lng, dest_lat, dest_lng,
        temp_breach_threshold, estimated_delivery, status, tx_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'created',$15,NOW(),NOW())
     RETURNING *`,
    [
      id, data.orderId, user.id, user.mspId || 'LogisticsMSP',
      data.thirdPartyRef || null, (data.cargoType || 'DRY').toUpperCase(),
      data.weightKg, data.volumeM3 || 0,
      data.origin?.latitude, data.origin?.longitude,
      data.destination?.latitude, data.destination?.longitude,
      data.tempBreachThreshold || 0,
      data.estimatedDelivery || null,
      txID,
    ]
  );
  return result.rows[0];
}

async function getById(userId, shipmentId) {
  const shipment = await _getShipment(shipmentId);
  // Allow provider, buyer, and farmer to view
  return shipment;
}

async function updateLocation(userId, shipmentId, location) {
  const shipment = await _getShipment(shipmentId);
  if (shipment.provider_id !== userId) throw new ForbiddenError('Only the logistics provider can update location');

  const ccLocation = JSON.stringify({
    latitude:  location.latitude,
    longitude: location.longitude,
    accuracy:  location.accuracy || 0,
  });

  try {
    await fabricClient.submitTransaction(
      FABRIC_CHANNEL, FABRIC_CHAINCODE, 'UpdateLocation', shipmentId, ccLocation
    );
  } catch (err) {
    logger.error({ event: 'fabric_update_location_failed', shipmentId, error: err.message });
    throw err;
  }

  // On first location update advance to picked_up
  const newStatus = shipment.status === 'created' ? 'picked_up' : shipment.status;

  const result = await db.query(
    `UPDATE shipments
     SET current_lat = $1, current_lng = $2, status = $3, updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [location.latitude, location.longitude, newStatus, shipmentId]
  );
  return result.rows[0];
}

async function recordIoT(userId, shipmentId, iotData) {
  const shipment = await _getShipment(shipmentId);
  if (shipment.provider_id !== userId) throw new ForbiddenError('Only the logistics provider can record IoT data');

  const ccIoT = JSON.stringify({
    temperature: iotData.temperature,
    humidity:    iotData.humidity || 0,
    deviceId:    iotData.deviceId || '',
  });

  try {
    await fabricClient.submitTransaction(
      FABRIC_CHANNEL, FABRIC_CHAINCODE, 'RecordIoT', shipmentId, ccIoT
    );
  } catch (err) {
    logger.error({ event: 'fabric_record_iot_failed', shipmentId, error: err.message });
    throw err;
  }

  const isBreach = shipment.temp_breach_threshold > 0 && iotData.temperature > shipment.temp_breach_threshold;

  const result = await db.query(
    `UPDATE shipments
     SET latest_temp = $1, latest_humidity = $2,
         temp_breach_count = temp_breach_count + $3,
         updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [iotData.temperature, iotData.humidity || 0, isBreach ? 1 : 0, shipmentId]
  );
  return result.rows[0];
}

const VALID_STATUS_TRANSITIONS = {
  created:           ['picked_up'],
  picked_up:         ['in_transit', 'damaged', 'returned'],
  in_transit:        ['out_for_delivery', 'damaged', 'returned'],
  out_for_delivery:  ['delivered', 'damaged', 'returned'],
  delivered:         [],
  damaged:           [],
  returned:          [],
};

async function updateStatus(userId, shipmentId, newStatus) {
  const shipment = await _getShipment(shipmentId);
  if (shipment.provider_id !== userId) throw new ForbiddenError('Only the logistics provider can update status');

  const allowed = VALID_STATUS_TRANSITIONS[shipment.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(
      `Cannot transition shipment from '${shipment.status}' to '${newStatus}'`
    );
  }

  try {
    await fabricClient.submitTransaction(
      FABRIC_CHANNEL, FABRIC_CHAINCODE, 'UpdateStatus', shipmentId, newStatus.toUpperCase()
    );
  } catch (err) {
    logger.error({ event: 'fabric_update_status_failed', shipmentId, error: err.message });
    throw err;
  }

  const result = await db.query(
    'UPDATE shipments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [newStatus, shipmentId]
  );
  return result.rows[0];
}

async function confirmDelivery(userId, shipmentId, proofHash) {
  if (!proofHash) throw new ValidationError('proofHash is required');
  const shipment = await _getShipment(shipmentId);

  try {
    await fabricClient.submitTransaction(
      FABRIC_CHANNEL, FABRIC_CHAINCODE, 'ConfirmDelivery', shipmentId, proofHash
    );
  } catch (err) {
    logger.error({ event: 'fabric_confirm_delivery_failed', shipmentId, error: err.message });
    throw err;
  }

  const result = await db.query(
    `UPDATE shipments
     SET status = 'delivered', delivery_proof_hash = $1, actual_delivery = NOW(), updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [proofHash, shipmentId]
  );
  return result.rows[0];
}

async function reportDamage(userId, shipmentId, notes) {
  if (!notes) throw new ValidationError('damage notes are required');
  const shipment = await _getShipment(shipmentId);
  if (shipment.provider_id !== userId) throw new ForbiddenError('Only the logistics provider can report damage');

  try {
    await fabricClient.submitTransaction(
      FABRIC_CHANNEL, FABRIC_CHAINCODE, 'ReportDamage', shipmentId, notes
    );
  } catch (err) {
    logger.error({ event: 'fabric_report_damage_failed', shipmentId, error: err.message });
    throw err;
  }

  const result = await db.query(
    "UPDATE shipments SET status = 'damaged', damage_notes = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [notes, shipmentId]
  );
  return result.rows[0];
}

async function list(user, query) {
  const { page = 1, limit = 20, status } = query;
  const offset     = (Number(page) - 1) * Number(limit);
  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (user.role === 'logistics') {
    conditions.push(`provider_id = $${idx++}`);
    params.push(user.id);
  }
  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows, count] = await Promise.all([
    db.query(
      `SELECT * FROM shipments ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset]
    ),
    db.query(`SELECT COUNT(*) FROM shipments ${where}`, params),
  ]);

  return {
    shipments: rows.rows,
    total:     parseInt(count.rows[0].count, 10),
    page:      Number(page),
    limit:     Number(limit),
  };
}

module.exports = {
  create, getById, updateLocation, recordIoT,
  updateStatus, confirmDelivery, reportDamage, list,
};
