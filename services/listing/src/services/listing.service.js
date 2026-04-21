'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../../../../shared/db');
const fabricClient = require('../../../../shared/fabric-client');
const { NotFoundError, ForbiddenError, ConflictError } = require('../../../../shared/error-handler');
const logger = require('../../../../shared/logger');

const FABRIC_CHANNEL = process.env.FABRIC_CHANNEL_NAME || 'agritrade-channel';
const FABRIC_CHAINCODE = 'trade';

async function create(user, data) {
  const id = uuidv4();
  const chaincodeInput = {
    id,
    title: data.title,
    category: data.category.toUpperCase(),
    quantity: data.quantity,
    unit: data.unit,
    pricePerUnit: data.pricePerUnit,
    currency: data.currency || 'INR',
    location: data.location,
    harvestDate: data.harvestDate,
    expiryDate: data.expiryDate,
    description: data.description || '',
    isOrganic: data.organic || false,
    farmerId: user.id,
  };

  // Submit to Fabric
  let fabricResult;
  try {
    const raw = await fabricClient.submitTransaction(
      FABRIC_CHANNEL, FABRIC_CHAINCODE, 'CreateListing', JSON.stringify(chaincodeInput)
    );
    fabricResult = JSON.parse(raw.toString());
  } catch (err) {
    logger.error({ event: 'fabric_create_listing_failed', error: err.message });
    throw err;
  }

  // Mirror to PostgreSQL for rich queries
  const result = await db.query(
    `INSERT INTO listings (id, farmer_id, farmer_msp, title, category, quantity, unit, price_per_unit, currency,
       location_lat, location_lng, harvest_date, expiry_date, description, is_organic, status, tx_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active',$16,NOW(),NOW()) RETURNING *`,
    [id, user.id, user.mspId, data.title, data.category.toLowerCase(), data.quantity, data.unit,
     data.pricePerUnit, data.currency || 'INR', data.location.lat, data.location.lng,
     data.harvestDate, data.expiryDate, data.description || null, data.organic || false,
     fabricResult.txID]
  );
  return result.rows[0];
}

async function getById(id) {
  const result = await db.query('SELECT * FROM listings WHERE id = $1', [id]);
  if (!result.rows.length) throw new NotFoundError(`Listing ${id} not found`);
  return result.rows[0];
}

async function search(query) {
  const { page = 1, limit = 20, category, minPrice, maxPrice, sort = 'created_at', order = 'desc' } = query;
  const offset = (page - 1) * limit;
  const conditions = ["status = 'active'", "expiry_date > NOW()"];
  const params = [];
  let idx = 1;

  if (category) { conditions.push(`category = $${idx++}`); params.push(category.toLowerCase()); }
  if (minPrice) { conditions.push(`price_per_unit >= $${idx++}`); params.push(Number(minPrice)); }
  if (maxPrice) { conditions.push(`price_per_unit <= $${idx++}`); params.push(Number(maxPrice)); }

  const allowedSort = { createdAt: 'created_at', price: 'price_per_unit', quantity: 'quantity' };
  const sortCol = allowedSort[sort] || 'created_at';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rowsResult, countResult] = await Promise.all([
    db.query(
      `SELECT * FROM listings ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, Number(limit), offset]
    ),
    db.query(`SELECT COUNT(*) FROM listings ${where}`, params),
  ]);

  return {
    listings: rowsResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page: Number(page),
    limit: Number(limit),
  };
}

async function update(userId, listingId, data) {
  const existing = await getById(listingId);
  if (existing.farmer_id !== userId) throw new ForbiddenError('You do not own this listing');
  if (existing.status !== 'active') throw new Error('Cannot update a non-active listing');

  const updates = [];
  const values = [];
  let idx = 1;
  const mapping = { pricePerUnit: 'price_per_unit', title: 'title', quantity: 'quantity', description: 'description' };

  for (const [key, col] of Object.entries(mapping)) {
    if (data[key] !== undefined) {
      updates.push(`${col} = $${idx++}`);
      values.push(data[key]);
    }
  }
  if (!updates.length) return existing;

  updates.push(`updated_at = NOW()`);
  values.push(listingId);
  const result = await db.query(`UPDATE listings SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values);
  return result.rows[0];
}

async function cancel(userId, listingId) {
  const existing = await getById(listingId);
  if (existing.farmer_id !== userId) throw new ForbiddenError('You do not own this listing');

  // Cancel on Fabric
  await fabricClient.submitTransaction(FABRIC_CHANNEL, FABRIC_CHAINCODE, 'CancelListing', listingId);

  const result = await db.query(
    "UPDATE listings SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *",
    [listingId]
  );
  return result.rows[0];
}

async function getByFarmer(farmerId, query) {
  const { page = 1, limit = 20 } = query;
  const offset = (page - 1) * limit;
  const [rows, count] = await Promise.all([
    db.query('SELECT * FROM listings WHERE farmer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [farmerId, Number(limit), offset]),
    db.query('SELECT COUNT(*) FROM listings WHERE farmer_id = $1', [farmerId]),
  ]);
  return { listings: rows.rows, total: parseInt(count.rows[0].count, 10), page: Number(page), limit: Number(limit) };
}

module.exports = { create, getById, search, update, cancel, getByFarmer };
