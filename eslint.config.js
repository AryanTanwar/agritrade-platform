'use strict';

const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'fabric/**',
      'chaincode/**',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require:   'readonly',
        module:    'readonly',
        exports:   'readonly',
        __dirname: 'readonly',
        __filename:'readonly',
        process:   'readonly',
        console:   'readonly',
        Buffer:    'readonly',
        setTimeout:'readonly',
        clearTimeout: 'readonly',
        setInterval:  'readonly',
        clearInterval:'readonly',
      },
    },
    rules: {
      'no-unused-vars':    ['warn', { argsIgnorePattern: '^_' }],
      'no-console':         'off',
      'no-undef':           'error',
      'prefer-const':       'warn',
      'no-var':             'error',
    },
  },
];