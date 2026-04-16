'use strict';

const { Router } = require('express');
const { authenticate, authorise, optionalAuth } = require('../../../shared/middleware/authenticate');
const { validate, schemas } = require('../../../shared/validators');
const listingController = require('../controllers/listing.controller');

const router = Router();

// GET /api/v1/listings — public browse with optional auth
router.get('/', optionalAuth, listingController.search);

// GET /api/v1/listings/farmer/me — authenticated farmer's own listings
// NOTE: must be registered before /:id to avoid "farmer/me" being treated as an id
router.get('/farmer/me', authenticate, authorise('farmer'), listingController.myListings);

// POST /api/v1/listings — create a new listing (farmer only)
router.post(
  '/',
  authenticate,
  authorise('farmer'),
  validate(schemas.createListing),
  listingController.create
);

// GET /api/v1/listings/:id — get single listing (optionally authenticated)
router.get('/:id', optionalAuth, listingController.getById);

// PUT /api/v1/listings/:id — update listing (owner farmer only)
router.put('/:id', authenticate, authorise('farmer'), listingController.update);

// DELETE /api/v1/listings/:id — cancel listing (owner farmer only)
router.delete('/:id', authenticate, authorise('farmer'), listingController.cancel);

module.exports = router;
