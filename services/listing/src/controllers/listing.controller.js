'use strict';

const listingService = require('../services/listing.service');

/**
 * GET /api/v1/listings
 * Public browse; req.user may or may not be set (optionalAuth).
 */
async function search(req, res, next) {
  try {
    const { listings, total, page, limit } = await listingService.search(req.query);
    res.json({
      success: true,
      data: listings,
      meta: { total, page, limit },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/listings
 * Create a new produce listing (farmer only).
 */
async function create(req, res, next) {
  try {
    const listing = await listingService.create(req.user, req.body);
    res.status(201).json({ success: true, data: listing });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/listings/:id
 * Retrieve a single listing by ID.
 */
async function getById(req, res, next) {
  try {
    const listing = await listingService.getById(req.params.id);
    res.json({ success: true, data: listing });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/listings/:id
 * Update a listing (owner farmer only).
 */
async function update(req, res, next) {
  try {
    const listing = await listingService.update(req.user.id, req.params.id, req.body);
    res.json({ success: true, data: listing });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/listings/:id
 * Cancel a listing (owner farmer only).
 */
async function cancel(req, res, next) {
  try {
    const listing = await listingService.cancel(req.user.id, req.params.id);
    res.json({ success: true, data: listing });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/listings/farmer/me
 * List all listings belonging to the authenticated farmer.
 */
async function myListings(req, res, next) {
  try {
    const { listings, total, page, limit } = await listingService.getByFarmer(req.user.id, req.query);
    res.json({
      success: true,
      data: listings,
      meta: { total, page, limit },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { search, create, getById, update, cancel, myListings };
