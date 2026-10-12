const jwt = require('jsonwebtoken');

/**
 * Generates test JWT ID tokens with varied payloads and structures.
 */

const DEFAULT_SECRET = 'test-jwt-secret';

function createJwt(payload, secret = DEFAULT_SECRET, options = {}) {
  return jwt.sign(payload, secret, options);
}

/**
 * Creates a standard user JWT token.
 * @param {Object} overrides - Payload overrides
 * @returns {string} Signed JWT token
 */
function createStandardUserJwt(overrides = {}) {
  const payload = {
    sub: 'user-standard-123',
    email: 'user@catalix.test',
    user_type: 'standard',
    is_support: false,
    groups: ['users'],
    name: 'Standard User',
    preferred_username: 'standarduser',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
  return createJwt(payload);
}

/**
 * Creates an admin / support user JWT token.
 * @param {Object} overrides - Payload overrides
 * @returns {string} Signed JWT token
 */
function createAdminSupportJwt(overrides = {}) {
  const payload = {
    sub: 'user-admin-456',
    email: 'admin@catalix.test',
    user_type: 'admin',
    is_support: true,
    groups: ['admins', 'users'],
    name: 'Admin User',
    preferred_username: 'adminuser',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
  return createJwt(payload);
}

/**
 * Creates a JWT token with custom user groups.
 * @param {string[]} groups - Array of group names
 * @param {Object} overrides - Payload overrides
 * @returns {string} Signed JWT token
 */
function createCustomGroupsJwt(groups = ['engineering', 'qa'], overrides = {}) {
  const payload = {
    sub: 'user-custom-789',
    email: 'custom@catalix.test',
    user_type: 'developer',
    is_support: false,
    groups,
    name: 'Custom Group User',
    preferred_username: 'customuser',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
  return createJwt(payload);
}

/**
 * Creates an expired JWT token.
 * @param {Object} overrides - Payload overrides
 * @returns {string} Signed JWT token
 */
function createExpiredJwt(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'user-expired-000',
    email: 'expired@catalix.test',
    user_type: 'standard',
    is_support: false,
    groups: ['users'],
    iat: now - 7200,
    exp: now - 3600,
    ...overrides,
  };
  return createJwt(payload);
}

/**
 * Returns malformed JWT structures for negative testing.
 * @param {'not-jwt'|'two-parts'|'four-parts'|'invalid-base64'|'invalid-json'} type
 * @returns {string} Malformed string
 */
function createMalformedJwt(type = 'not-jwt') {
  switch (type) {
    case 'not-jwt':
      return 'not-a-jwt-token';
    case 'two-parts':
      return '******';
    case 'four-parts':
      return '******';
    case 'invalid-base64':
      return '******';
    case 'invalid-json': {
      const invalidJsonBase64 = Buffer.from('{ invalid-json: true ').toString('base64');
      return `******;
    }
    default:
      return 'invalid.token';
  }
}

module.exports = {
  createJwt,
  createStandardUserJwt,
  createAdminSupportJwt,
  createCustomGroupsJwt,
  createExpiredJwt,
  createMalformedJwt,
};
