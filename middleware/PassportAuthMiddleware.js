const { PassportDeserializer } = require('../models/PassportUtils');

/**
 * Catalix Passport Authentication Middleware
 * Reads x-passport header, deserializes it, validates, and creates user context
 */
class PassportAuthMiddleware {
    /**
     * Creates the passport authentication middleware function
     * @param {Object} options - Configuration options
     * @param {boolean} options.required - Whether passport is required (default: true)
     * @param {Function} options.onMissingPassport - Callback when passport is missing
     * @param {Function} options.onInvalidPassport - Callback when passport is invalid
     * @returns {Function} Express middleware function
     */
    static create(options = {}) {
        const config = {
            required: options.required !== false, // Default to true
            onMissingPassport: options.onMissingPassport || null,
            onInvalidPassport: options.onInvalidPassport || null,
            logRequests: options.logRequests !== false // Default to true
        };

        return (req, res, next) => {
            try {
                // Get x-passport header
                const passportHeader = req.headers['x-passport'] || req.headers['X-Passport'];
                
                if (config.logRequests) {
                    console.log(`\n🎫 Passport Auth Check - ${req.method} ${req.url}`);
                    console.log(`Passport Header Present: ${!!passportHeader}`);
                }

                // Handle missing passport
                if (!passportHeader) {
                    if (config.logRequests) {
                        console.log('❌ Missing x-passport header');
                    }

                    if (config.onMissingPassport) {
                        return config.onMissingPassport(req, res, next);
                    }

                    if (config.required) {
                        return res.status(401).json({
                            error: 'Unauthorized',
                            message: 'Missing or invalid x-passport header',
                            code: 'MISSING_PASSPORT'
                        });
                    }

                    // Not required, continue without passport
                    req.passport = null;
                    req.user = null;
                    return next();
                }

                // Attempt to deserialize passport
                const passport = PassportDeserializer.safeDeserialize(passportHeader.trim());

                if (!passport) {
                    if (config.logRequests) {
                        console.log('❌ Invalid passport format or signature');
                    }

                    if (config.onInvalidPassport) {
                        return config.onInvalidPassport(req, res, next);
                    }

                    if (config.required) {
                        return res.status(401).json({
                            error: 'Unauthorized',
                            message: 'Invalid passport format or signature',
                            code: 'INVALID_PASSPORT'
                        });
                    }

                    // Not required, continue without passport
                    req.passport = null;
                    req.user = null;
                    return next();
                }

                // Validate passport
                if (!passport.isValid()) {
                    if (config.logRequests) {
                        console.log('❌ Passport validation failed');
                    }

                    if (config.required) {
                        return res.status(401).json({
                            error: 'Unauthorized',
                            message: 'Passport validation failed',
                            code: 'INVALID_PASSPORT_DATA'
                        });
                    }

                    req.passport = null;
                    req.user = null;
                    return next();
                }

                // Success - attach passport and user to request
                req.passport = passport;
                req.user = {
                    id: passport.UserID,
                    email: passport.Email,
                    isSupportUser: passport.IsSupportUser,
                    userGroups: passport.UserGroups,
                    userType: passport.UserType,
                    claims: passport.getClaims()
                };

                if (config.logRequests) {
                    console.log('✅ Passport authentication successful');
                    console.log(`User: ${passport.Email} (${passport.UserID})`);
                    console.log(`Groups: ${passport.UserGroups.join(', ')}`);
                    console.log(`Type: ${passport.UserType}`);
                }

                next();

            } catch (error) {
                console.error('🚨 Passport authentication error:', error);
                
                if (config.required) {
                    return res.status(500).json({
                        error: 'Internal Server Error',
                        message: 'Authentication processing failed',
                        code: 'AUTH_PROCESSING_ERROR'
                    });
                }

                req.passport = null;
                req.user = null;
                next();
            }
        };
    }

    /**
     * Creates middleware that requires valid passport (401 if missing/invalid)
     */
    static required(options = {}) {
        return PassportAuthMiddleware.create({ ...options, required: true });
    }

    /**
     * Creates middleware that optionally processes passport (continues if missing/invalid)
     */
    static optional(options = {}) {
        return PassportAuthMiddleware.create({ ...options, required: false });
    }

    /**
     * Creates middleware that requires specific user groups
     * @param {string|string[]} requiredGroups - Required user groups
     * @param {Object} options - Additional options
     */
    static requireGroups(requiredGroups, options = {}) {
        const groups = Array.isArray(requiredGroups) ? requiredGroups : [requiredGroups];
        
        return [
            PassportAuthMiddleware.required(options),
            (req, res, next) => {
                if (!req.user || !req.user.userGroups) {
                    return res.status(403).json({
                        error: 'Forbidden',
                        message: 'User groups not found',
                        code: 'MISSING_USER_GROUPS'
                    });
                }

                const userGroups = req.user.userGroups;
                const hasRequiredGroup = groups.some(group => userGroups.includes(group));

                if (!hasRequiredGroup) {
                    console.log(`🚫 Access denied - Required groups: ${groups.join(', ')}, User groups: ${userGroups.join(', ')}`);
                    return res.status(403).json({
                        error: 'Forbidden',
                        message: `Access denied. Required groups: ${groups.join(', ')}`,
                        code: 'INSUFFICIENT_PERMISSIONS',
                        requiredGroups: groups,
                        userGroups: userGroups
                    });
                }

                next();
            }
        ];
    }

    /**
     * Creates middleware that requires support user access
     */
    static requireSupportUser(options = {}) {
        return [
            PassportAuthMiddleware.required(options),
            (req, res, next) => {
                if (!req.user || !req.user.isSupportUser) {
                    console.log(`🚫 Access denied - Support user required, user: ${req.user?.email}`);
                    return res.status(403).json({
                        error: 'Forbidden',
                        message: 'Support user access required',
                        code: 'SUPPORT_USER_REQUIRED'
                    });
                }
                next();
            }
        ];
    }
}

module.exports = PassportAuthMiddleware;