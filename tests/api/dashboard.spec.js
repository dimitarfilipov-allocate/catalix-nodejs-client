const { test, expect } = require('../fixtures/auth-fixtures');
const {
  createValidPassport,
  createSupportUserPassport,
  createInvalidSignaturePassport,
  createInvalidFormatPassport,
  createInvalidDataPassport,
} = require('../helpers/auth-helpers');

test.describe('GET /dashboard (Protected Dashboard Endpoint)', () => {
  test('returns 401 with MISSING_PASSPORT when x-passport header is omitted', async ({ request }) => {
    const response = await request.get('/dashboard');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Unauthorized',
      message: 'Missing or invalid x-passport header',
      code: 'MISSING_PASSPORT',
    });
  });

  test('returns 401 with INVALID_PASSPORT when signature is tampered or mismatched', async ({ invalidPassportRequest }) => {
    const response = await invalidPassportRequest.get('/dashboard');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Unauthorized',
      message: 'Invalid passport format or signature',
      code: 'INVALID_PASSPORT',
    });
  });

  test('returns 401 with INVALID_PASSPORT when passport format is invalid', async ({ createPassportContext }) => {
    const invalidFormats = [
      createInvalidFormatPassport('garbage-string'),
      createInvalidFormatPassport('unsupported-version'),
      createInvalidFormatPassport('wrong-part-count'),
    ];

    for (const invalidHeader of invalidFormats) {
      const customContext = await createPassportContext(invalidHeader);
      const response = await customContext.get('/dashboard');

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.code).toBe('INVALID_PASSPORT');
    }
  });

  test('returns 401 with INVALID_PASSPORT_DATA when passport payload lacks UserID', async ({ createPassportContext }) => {
    const invalidDataPassport = createInvalidDataPassport('UserID');
    const customContext = await createPassportContext(invalidDataPassport);

    const response = await customContext.get('/dashboard');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Unauthorized',
      message: 'Passport validation failed',
      code: 'INVALID_PASSPORT_DATA',
    });
  });

  test('returns 401 with INVALID_PASSPORT_DATA when passport payload lacks Email', async ({ createPassportContext }) => {
    const invalidDataPassport = createInvalidDataPassport('Email');
    const customContext = await createPassportContext(invalidDataPassport);

    const response = await customContext.get('/dashboard');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Unauthorized',
      message: 'Passport validation failed',
      code: 'INVALID_PASSPORT_DATA',
    });
  });

  test('returns 401 with INVALID_PASSPORT_DATA when passport payload lacks UserType', async ({ createPassportContext }) => {
    const invalidDataPassport = createInvalidDataPassport('UserType');
    const customContext = await createPassportContext(invalidDataPassport);

    const response = await customContext.get('/dashboard');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Unauthorized',
      message: 'Passport validation failed',
      code: 'INVALID_PASSPORT_DATA',
    });
  });

  test('returns 200 and rendered dashboard HTML containing user info for standard user', async ({ authenticatedRequest }) => {
    const response = await authenticatedRequest.get('/dashboard');

    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('Welcome, user@catalix.test!');
    expect(html).toContain('Dashboard');
    expect(html).toContain('Profile');
    expect(html).toContain('Settings');
  });

  test('returns 200 and rendered dashboard HTML containing admin user info', async ({ supportUserRequest }) => {
    const response = await supportUserRequest.get('/dashboard');

    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain('Welcome, admin@catalix.test!');
  });

  test('tolerates lowercase x-passport header casing', async ({ createPassportContext }) => {
    const passport = createValidPassport({ Email: 'lowercase-header@catalix.test' });
    const customContext = await createPassportContext(passport, 'x-passport');

    const response = await customContext.get('/dashboard');
    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html).toContain('Welcome, lowercase-header@catalix.test!');
  });

  test('tolerates capitalized X-Passport header casing', async ({ createPassportContext }) => {
    const passport = createValidPassport({ Email: 'capitalized-header@catalix.test' });
    const customContext = await createPassportContext(passport, 'X-Passport');

    const response = await customContext.get('/dashboard');
    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html).toContain('Welcome, capitalized-header@catalix.test!');
  });
});
