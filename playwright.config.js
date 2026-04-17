// @ts-check
'use strict';

const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL  = process.env.API_URL  || 'http://localhost:8080';

module.exports = defineConfig({
  testDir:   './tests/e2e',
  fullyParallel: false,           // order-lifecycle tests share state — keep sequential
  forbidOnly: !!process.env.CI,
  retries:    process.env.CI ? 2 : 0,
  workers:    process.env.CI ? 1 : 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/e2e/report', open: 'never' }],
    ['junit', { outputFile: 'tests/e2e/results.xml' }],
  ],

  use: {
    baseURL:          BASE_URL,
    trace:            'retain-on-failure',
    screenshot:       'only-on-failure',
    video:            'retain-on-failure',
    actionTimeout:    15_000,
    navigationTimeout:30_000,
  },

  projects: [
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
    },
    // Uncomment to add mobile coverage:
    // { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],

  // Spin up the web dev server automatically during local runs
  webServer: process.env.CI ? undefined : {
    command:          'npm run dev --prefix client/web',
    url:              BASE_URL,
    reuseExistingServer: true,
    timeout:          30_000,
  },
});

module.exports.BASE_URL = BASE_URL;
module.exports.API_URL  = API_URL;
