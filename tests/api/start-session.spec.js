const { test, expect } = require('../fixtures/auth-fixtures');
const {
  createStandardUserJwt,
  createAdminSupportJwt,
  createCustomGroupsJwt,
  createMalformedJwt,
} = require('../helpers/token-generator');
const { deserializePassport } = require('../helpers/auth-helpers');

test.describe('POST /start-session (Session Initialization)', () => {
  test('returns 200 and a serialized passport when provided with a valid standard JWT ID token', async ({ request }) => {
    const token = createStandardUserJwt({
      sub: 'std-user-123',
      email: 'std-user@catalix.test',
      user_type: 'standard',
    });

    const response = await request.post('/start-session', {
      data: { token },
    });

    expect(response.status()).toBe(200);

    const passportText = await response.text();
    expect(passportText).toMatch(/^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);

    const deserialized = deserializePassport(passportText);
    expect(deserialized.UserID).toBe('std-user-123');
    expect(deserialized.Email).toBe('std-user@catalix.test');
    expect(deserialized.UserType).toBe('standard');
    expect(deserialized.IsSupportUser).toBe(false);
  });

  test('returns 200 and correctly reflects admin / support user attributes from JWT token', async ({ request }) => {
    const token = createAdminSupportJwt({
      sub: 'admin-support-456',
      email: 'admin@catalix.test',
      is_support: true,
      user_type: 'admin',
    });

    const response = await request.post('/start-session', {
      data: { token },
    });

    expect(response.status()).toBe(200);

    const passportText = await response.text();
    const deserialized = deserializePassport(passportText);
    expect(deserialized.UserID).toBe('admin-support-456');
    expect(deserialized.Email).toBe('admin@catalix.test');
    expect(deserialized.UserType).toBe('admin');
    expect(deserialized.IsSupportUser).toBe(true);
    expect(deserialized.UserGroups).toContain('admins');
  });

  test('returns 200 and preserves custom user groups in the generated passport', async ({ request }) => {
    const customGroups = ['security-auditors', 'devops'];
    const token = createCustomGroupsJwt(customGroups);

    const response = await request.post('/start-session', {
      data: { token },
    });

    expect(response.status()).toBe(200);

    const passportText = await response.text();
    const deserialized = deserializePassport(passportText);
    expect(deserialized.UserGroups).toEqual(customGroups);
  });

  test('returns 400 with MISSING_TOKEN when token field is omitted from request body', async ({ request }) => {
    const response = await request.post('/start-session', {
      data: {},
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Bad Request',
      message: 'Token is required',
      code: 'MISSING_TOKEN',
    });
  });

  test('returns 400 with MISSING_TOKEN when token is an empty string', async ({ request }) => {
    const response = await request.post('/start-session', {
      data: { token: '' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Bad Request',
      message: 'Token is required',
      code: 'MISSING_TOKEN',
    });
  });

  test('returns 400 with MISSING_TOKEN when token is non-string (number, boolean, object)', async ({ request }) => {
    const testCases = [
      { token: 12345 },
      { token: true },
      { token: { nested: 'token' } },
    ];

    for (const testCase of testCases) {
      const response = await request.post('/start-session', {
        data: testCase,
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('MISSING_TOKEN');
    }
  });

  test('returns 400 with INVALID_TOKEN_FORMAT when token is a single-part string', async ({ request }) => {
    const token = createMalformedJwt('not-jwt');
    const response = await request.post('/start-session', {
      data: { token },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Bad Request',
      message: 'Invalid token format',
      code: 'INVALID_TOKEN_FORMAT',
    });
  });

  test('returns 400 with INVALID_TOKEN_FORMAT when token has only two parts', async ({ request }) => {
    const token = createMalformedJwt('two-parts');
    const response = await request.post('/start-session', {
      data: { token },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Bad Request',
      message: 'Invalid token format',
      code: 'INVALID_TOKEN_FORMAT',
    });
  });

  test('returns 400 with INVALID_TOKEN_FORMAT when token has four parts', async ({ request }) => {
    const token = createMalformedJwt('four-parts');
    const response = await request.post('/start-session', {
      data: { token },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: 'Bad Request',
      message: 'Invalid token format',
      code: 'INVALID_TOKEN_FORMAT',
    });
  });
});
