const { test: base, expect } = require('@playwright/test');
const {
  createValidPassport,
  createSupportUserPassport,
  createInvalidSignaturePassport,
  createInvalidDataPassport,
} = require('../helpers/auth-helpers');

/**
 * Extended Playwright test with authentication fixtures for API testing.
 */
const test = base.extend({
  /**
   * Request context pre-configured with a valid standard user x-passport header.
   */
  authenticatedRequest: async ({ playwright, baseURL }, use) => {
    const passport = createValidPassport();
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        'x-passport': passport,
        'Accept': '*/*',
      },
    });
    await use(context);
    await context.dispose();
  },

  /**
   * Request context pre-configured with a valid support / admin user x-passport header.
   */
  supportUserRequest: async ({ playwright, baseURL }, use) => {
    const passport = createSupportUserPassport();
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        'x-passport': passport,
        'Accept': '*/*',
      },
    });
    await use(context);
    await context.dispose();
  },

  /**
   * Request context pre-configured with an invalid / corrupted signature x-passport header.
   */
  invalidPassportRequest: async ({ playwright, baseURL }, use) => {
    const passport = createInvalidSignaturePassport();
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        'x-passport': passport,
        'Accept': '*/*',
      },
    });
    await use(context);
    await context.dispose();
  },

  /**
   * Request context pre-configured with an invalid data passport (missing required identity properties).
   */
  invalidDataPassportRequest: async ({ playwright, baseURL }, use) => {
    const passport = createInvalidDataPassport('UserID');
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        'x-passport': passport,
        'Accept': '*/*',
      },
    });
    await use(context);
    await context.dispose();
  },

  /**
   * Helper function fixture to create custom request contexts with arbitrary passport and headers.
   */
  createPassportContext: async ({ playwright, baseURL }, use) => {
    const createdContexts = [];
    const factory = async (passportValue, headerName = 'x-passport') => {
      const headers = { 'Accept': '*/*' };
      if (passportValue !== undefined) {
        headers[headerName] = passportValue;
      }
      const context = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: headers,
      });
      createdContexts.push(context);
      return context;
    };

    await use(factory);

    for (const ctx of createdContexts) {
      await ctx.dispose();
    }
  },
});

module.exports = {
  test,
  expect,
};
