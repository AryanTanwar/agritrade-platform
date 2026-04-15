'use strict';

const Joi = require('joi');

// ─── Reusable primitives ──────────────────────────────────────────────────────

const uuid        = Joi.string().uuid({ version: 'uuidv4' });
const mongoId     = Joi.string().alphanum().length(24);
const phoneIN     = Joi.string().pattern(/^\+91[6-9]\d{9}$/).messages({
  'string.pattern.base': 'Phone must be a valid Indian mobile number (+91XXXXXXXXXX)',
});
const email       = Joi.string().email({ tlds: { allow: false } }).lowercase().trim().max(254);
const password    = Joi.string()
  .min(12).max(72)
  .pattern(/[A-Z]/, 'uppercase')
  .pattern(/[a-z]/, 'lowercase')
  .pattern(/\d/,    'digit')
  .pattern(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/, 'special character')
  .messages({
    'string.min':              'Password must be at least 12 characters.',
    'string.pattern.name':     'Password must contain at least one {#name}.',
  });
const otp         = Joi.string().length(6).pattern(/^\d+$/);
const coordinates = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

// ─── Auth schemas ─────────────────────────────────────────────────────────────

const registerFarmer = Joi.object({
  name:         Joi.string().trim().min(2).max(100).required(),
  phone:        phoneIN.required(),
  email:        email.optional(),
  password:     password.required(),
  aadhaarLast4: Joi.string().length(4).pattern(/^\d+$/).optional(),
  village:      Joi.string().trim().max(100).optional(),
  district:     Joi.string().trim().max(100).required(),
  state:        Joi.string().trim().max(100).required(),
  pincode:      Joi.string().pattern(/^\d{6}$/).required(),
}).options({ stripUnknown: true });

const registerBuyer = Joi.object({
  name:         Joi.string().trim().min(2).max(100).required(),
  phone:        phoneIN.required(),
  email:        email.required(),
  password:     password.required(),
  role:         Joi.string().valid('retailer', 'wholesaler', 'buyer').required(),
  businessName: Joi.string().trim().max(200).optional(),
  gstNumber:    Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional()
                   .messages({ 'string.pattern.base': 'Invalid GST number format' }),
  address:      Joi.string().trim().max(500).required(),
  pincode:      Joi.string().pattern(/^\d{6}$/).required(),
}).options({ stripUnknown: true });

const login = Joi.object({
  phone:    phoneIN.optional(),
  email:    email.optional(),
  password: Joi.string().required(),
}).or('phone', 'email').options({ stripUnknown: true });

const verifyOTP = Joi.object({
  phone: phoneIN.required(),
  otp:   otp.required(),
}).options({ stripUnknown: true });

// ─── Produce listing schemas ───────────────────────────────────────────────────

const createListing = Joi.object({
  title:        Joi.string().trim().min(3).max(200).required(),
  category:     Joi.string().valid(
    'grains', 'pulses', 'vegetables', 'fruits', 'spices',
    'oilseeds', 'cotton', 'sugarcane', 'dairy', 'poultry', 'other'
  ).required(),
  quantity:     Joi.number().positive().max(1_000_000).required(),
  unit:         Joi.string().valid('kg', 'quintal', 'tonne', 'litre', 'dozen', 'piece').required(),
  pricePerUnit: Joi.number().positive().max(1_000_000).required(),
  currency:     Joi.string().valid('INR').default('INR'),
  harvestDate:  Joi.date().iso().max('now').required(),
  expiryDate:   Joi.date().iso().greater(Joi.ref('harvestDate')).required(),
  location:     coordinates.required(),
  description:  Joi.string().trim().max(1000).optional(),
  organic:      Joi.boolean().default(false),
}).options({ stripUnknown: true });

// ─── Order schemas ────────────────────────────────────────────────────────────

const createOrder = Joi.object({
  listingId:       uuid.required(),
  quantity:        Joi.number().positive().required(),
  deliveryAddress: Joi.string().trim().max(500).required(),
  deliveryPincode: Joi.string().pattern(/^\d{6}$/).required(),
  notes:           Joi.string().trim().max(500).optional(),
}).options({ stripUnknown: true });

// ─── Pagination ───────────────────────────────────────────────────────────────

const pagination = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort:  Joi.string().valid('createdAt', 'price', 'quantity').default('createdAt'),
  order: Joi.string().valid('asc', 'desc').default('desc'),
}).options({ stripUnknown: true });

// ─── Validator middleware factory ─────────────────────────────────────────────

/**
 * Returns an Express middleware that validates req.body against a Joi schema.
 * On failure, responds 400 with the first validation error message.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: true });
    if (error) {
      return res.status(400).json({
        success: false,
        code:    'VALIDATION_ERROR',
        error:   error.details[0].message,
      });
    }
    req[source] = value; // replace with sanitized + defaulted value
    next();
  };
}

module.exports = {
  schemas: {
    registerFarmer,
    registerBuyer,
    login,
    verifyOTP,
    createListing,
    createOrder,
    pagination,
  },
  validate,
};
