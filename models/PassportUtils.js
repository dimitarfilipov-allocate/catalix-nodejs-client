const AuthenticationPassport = require('./AuthenticationPassport');

/**
 * PassportSerializer utility for serializing passports
 */
class PassportSerializer {
    /**
     * Serializes an AuthenticationPassport to a protobuf text string
     * @param {AuthenticationPassport} passport - The passport to serialize
     * @returns {string} Serialized passport in format: v1.{Base64Payload}.{Base64Signature}
     */
    static serialize(passport) {
        if (!(passport instanceof AuthenticationPassport)) {
            throw new Error('Invalid passport object provided');
        }
        
        return passport.asProtoBuffText();
    }

    /**
     * Creates a passport from various sources and serializes it
     * @param {Object} data - User data to create passport from
     * @returns {string} Serialized passport
     */
    static createAndSerialize(data) {
        const passport = new AuthenticationPassport(data);
        return PassportSerializer.serialize(passport);
    }
}

/**
 * PassportDeserializer utility for deserializing passports
 */
class PassportDeserializer {
    /**
     * Deserializes a passport protobuf text string back to AuthenticationPassport
     * @param {string} passportText - The serialized passport string
     * @returns {AuthenticationPassport} Deserialized passport object
     */
    static deserialize(passportText) {
        try {
            if (!passportText || typeof passportText !== 'string') {
                throw new Error('Invalid passport text provided');
            }

            const parts = passportText.split('.');
            if (parts.length !== 3 || parts[0] !== 'v1') {
                throw new Error('Invalid passport format');
            }

            // Decode the base64 payload
            const payloadBytes = Buffer.from(parts[1], 'base64');
            const payloadJson = payloadBytes.toString('utf8');
            const payloadData = JSON.parse(payloadJson);

            // Verify signature (in production, use proper signature verification)
            const expectedSignature = Buffer.from('static.passport.test', 'ascii').toString('base64');
            if (parts[2] !== expectedSignature) {
                throw new Error('Invalid passport signature');
            }

            // Create and return passport object
            const passport = new AuthenticationPassport(payloadData);
            
            if (!passport.isValid()) {
                throw new Error('Deserialized passport is invalid');
            }

            return passport;
        } catch (error) {
            throw new Error(`Failed to deserialize passport: ${error.message}`);
        }
    }

    /**
     * Safely attempts to deserialize a passport, returns null if invalid
     * @param {string} passportText - The serialized passport string
     * @returns {AuthenticationPassport|null} Deserialized passport or null if invalid
     */
    static safeDeserialize(passportText) {
        try {
            return PassportDeserializer.deserialize(passportText);
        } catch (error) {
            console.warn('Failed to deserialize passport:', error.message);
            return null;
        }
    }
}

/**
 * PassportGenerator utility for generating passports from tokens
 */
class PassportGenerator {
    /**
     * Creates a passport from a JWT ID token
     * @param {string} idToken - JWT ID token
     * @returns {string} Serialized passport
     */
    static createPassportFromIdToken(idToken) {
        try {
            const passport = AuthenticationPassport.fromIdToken(idToken);
            return passport.asProtoBuffText();
        } catch (error) {
            throw new Error(`Failed to generate passport from ID token: ${error.message}`);
        }
    }

    /**
     * Creates a demo passport for testing purposes
     * @param {Object} userData - User data override
     * @returns {string} Serialized demo passport
     */
    static createDemoPassport(userData = {}) {
        const defaultData = {
            UserID: 'demo-user-123',
            Email: 'demo@catalix.com',
            IsSupportUser: false,
            UserGroups: ['users', 'demo'],
            UserType: 'demo',
            OptionalClaims: {
                name: 'Demo User',
                preferred_username: 'demo',
                role: 'user'
            }
        };

        const passport = new AuthenticationPassport({ ...defaultData, ...userData });
        return passport.asProtoBuffText();
    }
}

module.exports = {
    AuthenticationPassport,
    PassportSerializer,
    PassportDeserializer,
    PassportGenerator
};