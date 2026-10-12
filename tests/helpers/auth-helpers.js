const {
  AuthenticationPassport,
  PassportGenerator,
  PassportSerializer,
  PassportDeserializer,
} = require('../../models/PassportUtils');

/**
 * Creates a valid serialized passport with customizable attributes.
 * @param {Object} overrides - Attributes to override in the passport
 * @returns {string} Serialized passport string (v1.{payload}.{signature})
 */
function createValidPassport(overrides = {}) {
  const defaultData = {
    UserID: 'user-standard-123',
    Email: 'user@catalix.test',
    IsSupportUser: false,
    UserGroups: ['users'],
    UserType: 'standard',
    OptionalClaims: {
      name: 'Standard User',
      preferred_username: 'standarduser',
    },
  };
  const passport = new AuthenticationPassport({ ...defaultData, ...overrides });
  return PassportSerializer.serialize(passport);
}

/**
 * Creates a valid serialized passport for a support/admin user.
 * @param {Object} overrides
 * @returns {string} Serialized passport string
 */
function createSupportUserPassport(overrides = {}) {
  return createValidPassport({
    UserID: 'user-admin-456',
    Email: 'admin@catalix.test',
    IsSupportUser: true,
    UserGroups: ['admins', 'users'],
    UserType: 'admin',
    OptionalClaims: {
      name: 'Admin User',
      role: 'admin',
    },
    ...overrides,
  });
}

/**
 * Creates a valid serialized passport for a user with custom groups.
 * @param {string[]} groups
 * @param {Object} overrides
 * @returns {string} Serialized passport string
 */
function createCustomGroupsPassport(groups = ['engineering', 'qa'], overrides = {}) {
  return createValidPassport({
    UserID: 'user-custom-789',
    Email: 'custom@catalix.test',
    UserGroups: groups,
    UserType: 'developer',
    ...overrides,
  });
}

/**
 * Creates a passport with an invalid signature.
 * @param {Object} overrides
 * @returns {string} Serialized passport with corrupted signature
 */
function createInvalidSignaturePassport(overrides = {}) {
  const validPassport = createValidPassport(overrides);
  const parts = validPassport.split('.');
  const corruptedSignature = Buffer.from('invalid.signature.test', 'ascii').toString('base64');
  return `${parts[0]}.${parts[1]}.${corruptedSignature}`;
}

/**
 * Creates a passport with an invalid format.
 * @param {'unsupported-version'|'wrong-part-count'|'garbage-string'} type
 * @returns {string}
 */
function createInvalidFormatPassport(type = 'unsupported-version') {
  switch (type) {
    case 'unsupported-version': {
      const valid = createValidPassport();
      const parts = valid.split('.');
      return `v2.${parts[1]}.${parts[2]}`;
    }
    case 'wrong-part-count':
      return 'v1.onlytwoparts';
    case 'garbage-string':
    default:
      return 'not-a-valid-passport-header';
  }
}

/**
 * Creates a passport that has a valid signature and format but fails .isValid() validation
 * (i.e. missing UserID, Email, or UserType).
 * @param {'UserID'|'Email'|'UserType'} missingField
 * @returns {string}
 */
function createInvalidDataPassport(missingField = 'UserID') {
  const data = {
    UserID: 'valid-user-id',
    Email: 'user@catalix.test',
    IsSupportUser: false,
    UserGroups: ['users'],
    UserType: 'standard',
  };

  if (missingField === 'UserID') {
    data.UserID = '';
  } else if (missingField === 'Email') {
    data.Email = '';
  } else if (missingField === 'UserType') {
    data.UserType = '';
  }

  const passport = new AuthenticationPassport(data);
  return PassportSerializer.serialize(passport);
}

/**
 * Generates a passport using the project's PassportGenerator.
 * @param {string} idToken - JWT ID token
 * @returns {string}
 */
function generatePassportFromIdToken(idToken) {
  return PassportGenerator.createPassportFromIdToken(idToken);
}

/**
 * Deserializes a passport using PassportDeserializer.
 * @param {string} passportString
 * @returns {AuthenticationPassport}
 */
function deserializePassport(passportString) {
  return PassportDeserializer.deserialize(passportString);
}

module.exports = {
  createValidPassport,
  createSupportUserPassport,
  createCustomGroupsPassport,
  createInvalidSignaturePassport,
  createInvalidFormatPassport,
  createInvalidDataPassport,
  generatePassportFromIdToken,
  deserializePassport,
};
