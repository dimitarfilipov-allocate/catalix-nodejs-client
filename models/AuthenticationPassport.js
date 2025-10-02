const crypto = require('crypto');

/**
 * AuthenticationPassport model similar to the .NET implementation
 * Contains user identification and authorization information
 */
class AuthenticationPassport {
    constructor(data = {}) {
        this.UserID = data.UserID || '';
        this.Email = data.Email || '';
        this.IsSupportUser = data.IsSupportUser || false;
        this.UserGroups = data.UserGroups || [];
        this.OptionalClaims = data.OptionalClaims || {};
        this.UserType = data.UserType || '';
        this.Timestamp = data.Timestamp || new Date().toISOString();
    }

    /**
     * Serializes the passport to a protobuf-like text string
     * Format: v1.{Base64Payload}.{Base64Signature}
     */
    asProtoBuffText() {
        try {
            // Create payload object
            const payload = {
                UserID: this.UserID,
                Email: this.Email,
                IsSupportUser: this.IsSupportUser,
                UserGroups: this.UserGroups,
                OptionalClaims: this.OptionalClaims,
                UserType: this.UserType,
                Timestamp: this.Timestamp
            };

            // Serialize to JSON and encode as base64
            const jsonPayload = JSON.stringify(payload);
            const serialized = Buffer.from(jsonPayload, 'utf8').toString('base64');
            
            // Create signature (static for now, should use proper signing in production)
            const signature = Buffer.from('static.passport.test', 'ascii').toString('base64');

            return `v1.${serialized}.${signature}`;
        } catch (error) {
            throw new Error(`Failed to serialize passport: ${error.message}`);
        }
    }

    /**
     * Creates a passport from a JWT ID token
     */
    static fromIdToken(idToken) {
        try {
            // In a real implementation, you would verify and decode the JWT
            // For now, we'll create a mock implementation
            
            // Decode JWT payload (without verification for demo purposes)
            const parts = idToken.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT format');
            }

            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            
            return new AuthenticationPassport({
                UserID: payload.sub || payload.user_id || 'unknown',
                Email: payload.email || 'unknown@example.com',
                IsSupportUser: payload.is_support || false,
                UserGroups: payload.groups || ['user'],
                UserType: payload.user_type || 'standard',
                OptionalClaims: {
                    name: payload.name || '',
                    preferred_username: payload.preferred_username || '',
                    iat: payload.iat,
                    exp: payload.exp
                }
            });
        } catch (error) {
            throw new Error(`Failed to create passport from ID token: ${error.message}`);
        }
    }

    /**
     * Validates the passport data
     */
    isValid() {
        return !!(this.UserID && this.Email && this.UserType);
    }

    /**
     * Gets user claims for authorization
     */
    getClaims() {
        return {
            userId: this.UserID,
            email: this.Email,
            isSupportUser: this.IsSupportUser,
            userGroups: this.UserGroups,
            userType: this.UserType,
            ...this.OptionalClaims
        };
    }
}

module.exports = AuthenticationPassport;