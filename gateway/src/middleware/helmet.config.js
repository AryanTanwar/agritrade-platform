'use strict';

/**
 * Helmet security headers configuration
 * Applied at API gateway level — all services inherit via proxy
 */
const helmetConfig = {
  // Content Security Policy — strict whitelist
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],                       // No inline scripts
      styleSrc:       ["'self'", "'unsafe-inline'"],    // Allow inline styles for UI
      imgSrc:         ["'self'", 'data:', 'https:'],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'"],
      objectSrc:      ["'none'"],
      mediaSrc:       ["'none'"],
      frameSrc:       ["'none'"],
      frameAncestors: ["'none'"],                       // Prevents clickjacking
      formAction:     ["'self'"],
      baseUri:        ["'self'"],
      upgradeInsecureRequests: [],
    },
  },

  // HTTP Strict Transport Security — 2 years, include subdomains
  hsts: {
    maxAge:            63072000,
    includeSubDomains: true,
    preload:           true,
  },

  // Prevent MIME-type sniffing
  noSniff: true,

  // Referrer policy — no referrer to external sites
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // X-Frame-Options — deny embedding in iframes
  frameguard: {
    action: 'deny',
  },

  // Disable X-Powered-By (hides Express)
  hidePoweredBy: true,

  // X-XSS-Protection (legacy browsers)
  xssFilter: true,

  // DNS prefetch control
  dnsPrefetchControl: {
    allow: false,
  },

  // Permissions Policy — restrict browser features
  permissionsPolicy: {
    features: {
      camera:          ["'none'"],
      microphone:      ["'none'"],
      geolocation:     ["'self'"],
      payment:         ["'self'"],
      usb:             ["'none'"],
      fullscreen:      ["'self'"],
    },
  },

  // Cross-Origin settings
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  crossOriginOpenerPolicy:   { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
};

module.exports = helmetConfig;
