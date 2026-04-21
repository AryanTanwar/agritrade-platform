'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../../../../shared/db');
const fabricClient = require('../../../../shared/fabric-client');
const { NotFoundError, ForbiddenError, ValidationError } = require('../../../../shared/error-handler');
const logger = require('../../../../shared/logger');

const FABRIC_CHANNEL = process.env.FABRIC_CHANNEL_NAME || 'agritrade-channel';
const FABRIC_CHAINCODE = 'trade';

// Status machine mirrors chaincode
const VALID_TRANSITIONS = {
  placed:        ['confirmed', 'cancelled'],
  confirmed:     ['escrow_held', 'cancelled'],
  escrow_held:   ['in_transit', 'disputed'],
  in_transit:    ['delivered'],
  delivered:     ['completed'],
  completed:     [],
  cancelled:     [],
  disputed:      [],
};

async function placeOrder(user, data) {
  // Get listing from DB for price + availability
  const listingResult = await db.query("SELECT * FROM listings WHERE id = $1 AND status = 'active'", [data.listingId]);
  const listing = listingResult.rows[0];
  if (!listing) throw new NotFoundError('Listing not found or not active');
  if (data.quantity > listing.quantity) throw new ValidationError(`Only ${listing.quantity} ${listing.unit} available`);

  const id = uuidv4();
  const totalAmount = data.quantity * listing.price_per_unit;

  const chaincodeInput = {
    id,
    listingId: data.listingId,
    quantity: data.quantity,
    deliveryAddress: data.deliveryAddress,
    deliveryPincode: data.deliveryPincode,
    notes: data.notes || '',
  };

  let fabricResult;
  try {
    const raw = await fabricClient.submitTransaction(
      FABRIC_CHANNEL, FABRIC_CHAINCODE, 'PlaceOrder', JSON.stringify(chaincodeInput)
    );
    fabricResult = JSON.parse(raw.toString());
  } catch (err) {
    logger.error({ event: 'fabric_place_order_failed', error: err.message });
    throw err;
  }

  const result = await db.query(
    `INSERT INTO orders (id, listing_id, buyer_id, buyer_msp, farmer_id, farmer_msp, quantity, unit_price, total_amount,
       currency, delivery_address, delivery_pincode, notes, status, tx_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'placed',$14,NOW(),NOW()) RETURNING *`,
    [id, data.listingId, user.id, user.mspId, listing.farmer_id, listing.farmer_msp,
     data.quantity, listing.price_per_unit, totalAmount, listing.currency,
     data.deliveryAddress, data.deliveryPincode, data.notes || null, fabricResult.txID]
  );

  // Reduce listing available quantity
  await db.query('UPDATE listings SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2', [data.quantity, data.listingId]);

  return result.rows[0];
}

async function getById(userId, orderId) {
  const result = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = result.rows[0];
  if (!order) throw new NotFoundError(`Order ${orderId} not found`);
  if (order.buyer_id !== userId && order.farmer_id !== userId) throw new ForbiddenError('Access denied');
  return order;
}

async function listByUser(user, query) {
  const { page = 1, limit = 20, status } = query;
  const offset = (page - 1) * limit;
  const field = user.role === 'farmer' ? 'farmer_id' : 'buyer_id';
  const conditions = [`${field} = $1`];
  const params = [user.id];
  let idx = 2;
  if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const [rows, count] = await Promise.all([
    db.query(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, Number(limit), offset]),
    db.query(`SELECT COUNT(*) FROM orders ${where}`, params),
  ]);
  return { orders: rows.rows, total: parseInt(count.rows[0].count, 10), page: Number(page), limit: Number(limit) };
}

async function _transition(userId, orderId, newStatus, chaincodeMethod, chaincodeArgs = [], updateFields = {}) {
  const order = await getById(userId, orderId);
  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(`Cannot transition order from '${order.status}' to '${newStatus}'`);
  }

  try {
    await fabricClient.submitTransaction(FABRIC_CHANNEL, FABRIC_CHAINCODE, chaincodeMethod, orderId, ...chaincodeArgs);
  } catch (err) {
    logger.error({ event: 'fabric_order_transition_failed', method: chaincodeMethod, error: err.message });
    throw err;
  }

  const sets = [`status = '${newStatus}'`, 'updated_at = NOW()'];
  const params = [orderId];
  let idx = 2;
  for (const [col, val] of Object.entries(updateFields)) {
    sets.push(`${col} = $${idx++}`);
    params.push(val);
  }

  const result = await db.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
  return result.rows[0];
}

async function confirm(farmerId, orderId) {
  return _transition(farmerId, orderId, 'confirmed', 'ConfirmOrder');
}

async function attachEscrow(farmerId, orderId, escrowId) {
  return _transition(farmerId, orderId, 'escrow_held', 'AttachEscrow', [escrowId], { escrow_id: escrowId });
}

async function markInTransit(farmerId, orderId, shipmentId) {
  return _transition(farmerId, orderId, 'in_transit', 'MarkInTransit', [shipmentId], { shipment_id: shipmentId });
}

async function confirmDelivery(buyerId, orderId) {
  const updated = await _transition(buyerId, orderId, 'delivered', 'ConfirmDelivery');
  await db.query('UPDATE orders SET delivered_at = NOW() WHERE id = $1', [orderId]);
  return updated;
}

async function complete(farmerId, orderId) {
  const updated = await _transition(farmerId, orderId, 'completed', 'CompleteOrder');
  await db.query('UPDATE orders SET completed_at = NOW() WHERE id = $1', [orderId]);
  return updated;
}

async function dispute(userId, orderId, reason) {
  if (!reason) throw new ValidationError('Dispute reason is required');
  return _transition(userId, orderId, 'disputed', 'DisputeOrder', [], { dispute_reason: reason });
}

async function cancel(userId, orderId, reason) {
  const order = await getById(userId, orderId);
  if (!['placed', 'confirmed'].includes(order.status)) {
    throw new ValidationError('Order cannot be cancelled at this stage');
  }
  // Restore listing quantity
  await db.query('UPDATE listings SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2', [order.quantity, order.listing_id]);
  return _transition(userId, orderId, 'cancelled', 'CancelOrder', [reason || '']);
}

async function getHistory(userId, orderId) {
  await getById(userId, orderId); // access check
  const result = await db.query(
    'SELECT * FROM order_events WHERE order_id = $1 ORDER BY created_at ASC',
    [orderId]
  );
  return result.rows;
}

module.exports = { placeOrder, getById, listByUser, confirm, attachEscrow, markInTransit, confirmDelivery, complete, dispute, cancel, getHistory };
