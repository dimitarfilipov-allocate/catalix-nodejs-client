// @ts-check
const { defineConfig } = require('@playwright/test');

const PORT = process.env.TEST_PORT || process.env.PORT || 3000;
const baseURL = process.env.BASE_URL || `http://localhost:${PORT}`;

/**
 * Playwright configuration dedicated to API testing against the Express server.
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid port and session contention in API tests
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    extraHTTPHeaders: {
      'Accept': '*/*',
    },
    trace: 'retain-on-failure',
  },

  /* Automatically start the Express app before running API tests */
  webServer: {
    command: 'node app.js',
    url: `${baseURL}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      PORT: String(PORT),
      NODE_ENV: 'test',
      OTEL_SDK_DISABLED: 'true',
    },
  },
});
