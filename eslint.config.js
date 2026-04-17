'use strict';

const js = require('@eslint/js');

/** Globals shared by every Node.js file */
const nodeGlobals = {
  require:      'readonly',
  module:       'readonly',
  exports:      'readonly',
  __dirname:    'readonly',
  __filename:   'readonly',
  process:      'readonly',
  console:      'readonly',
  Buffer:       'readonly',
  setTimeout:   'readonly',
  clearTimeout: 'readonly',
  setInterval:  'readonly',
  clearInterval:'readonly',
  URL:          'readonly',
  URLSearchParams: 'readonly',
};

/** Jest globals used in all test files */
const jestGlobals = {
  describe:   'readonly',
  test:       'readonly',
  it:         'readonly',
  expect:     'readonly',
  beforeEach: 'readonly',
  afterEach:  'readonly',
  beforeAll:  'readonly',
  afterAll:   'readonly',
  jest:       'readonly',
};

module.exports = [
  js.configs.recommended,

  // ── 1. Default: all JS files (CommonJS Node) ────────────────────────────────
  {
    files: ['**/*.js'],
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'fabric/**',
      'chaincode/**',
      'frontend/**',
      'mobile/**',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'commonjs',
      globals:     nodeGlobals,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console':      'off',
      'no-undef':        'error',
      'prefer-const':    'warn',
      'no-var':          'error',
    },
  },

  // ── 2. Jest unit & integration tests ────────────────────────────────────────
  {
    files: [
      'tests/unit/**/*.js',
      'tests/integration/**/*.js',
      '**/*.test.js',
      '**/*.spec.js',
    ],
    languageOptions: {
      globals: { ...nodeGlobals, ...jestGlobals },
    },
  },

  // ── 3. k6 load tests — ES module syntax + k6 built-ins ──────────────────────
  {
    files: ['tests/load/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'module',
      globals: {
        // k6 built-in globals
        __ENV:     'readonly',
        __ITER:    'readonly',
        __VU:      'readonly',
        open:      'readonly',
      },
    },
    rules: {
      // k6 scripts don't use Node.js require
      'no-undef': 'error',
    },
  },

  // ── 4. Playwright e2e tests — Node 18 fetch + Playwright globals ─────────────
  {
    files: ['tests/e2e/**/*.js', 'playwright.config.js'],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        fetch:   'readonly',   // Node 18+ built-in
        Headers: 'readonly',
        Request: 'readonly',
        Response:'readonly',
      },
    },
  },
];
