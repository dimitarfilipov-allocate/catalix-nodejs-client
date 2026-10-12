const { getTelemetryUtils } = require('../telemetry');

/**
 * Catalix Telemetry Middleware
 * Enhances OpenTelemetry traces with Catalix-specific context and user information
 */
class CatalixTelemetryMiddleware {
    
    /**
     * Middleware that adds Catalix context to all requests
     */
    static enhance() {
        return (req, res, next) => {
            const telemetry = getTelemetryUtils();
            
            try {
                // Create a custom span for this request if not already created by instrumentation
                const span = telemetry.createSpan('catalix.request.processing', {
                    'http.method': req.method,
                    'http.url': req.url,
                    'http.route': req.route?.path || 'unknown',
                    'catalix.request.id': req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                });

                // Add Catalix-specific request context
                span.setAttributes({
                    'catalix.component': 'express-app',
                    'catalix.middleware': 'telemetry',
                    'catalix.request.hasPassport': !!(req.headers['x-passport']),
                    'catalix.request.userAgent': req.get('User-Agent') || 'unknown',
                    'catalix.request.contentType': req.get('Content-Type') || 'unknown',
                });

                // Store span in request for potential use in route handlers
                req.telemetrySpan = span;

                // Override res.json to capture response data
                const originalJson = res.json;
                res.json = function(data) {
                    if (span) {
                        span.setAttributes({
                            'catalix.response.hasData': !!data,
                            'catalix.response.dataType': typeof data,
                        });
                        
                        // Add error information if present
                        if (data && data.error) {
                            span.setAttributes({
                                'catalix.response.error': true,
                                'catalix.response.errorCode': data.code || 'unknown',
                            });
                        }
                    }
                    return originalJson.call(this, data);
                };

                // Override res.render to capture template information
                const originalRender = res.render;
                res.render = function(view, locals, callback) {
                    if (span) {
                        span.setAttributes({
                            'catalix.response.type': 'template',
                            'catalix.template.name': view,
                            'catalix.template.hasLocals': !!locals,
                        });
                    }
                    return originalRender.call(this, view, locals, callback);
                };

                // Handle response completion
                res.on('finish', () => {
                    if (span) {
                        span.setAttributes({
                            'http.status_code': res.statusCode,
                            'catalix.response.success': res.statusCode < 400,
                        });
                        span.end();
                    }
                });

                next();
            } catch (error) {
                telemetry.recordError(error, {
                    'catalix.middleware.error': 'telemetry_middleware_error',
                });
                console.error('Telemetry middleware error:', error);
                next(); // Continue even if telemetry fails
            }
        };
    }

    /**
     * Middleware that adds user context after authentication
     * Should be used after PassportAuthMiddleware
     */
    static addUserContext() {
        return (req, res, next) => {
            const telemetry = getTelemetryUtils();
            
            try {
                // Add user context if available
                if (req.user) {
                    telemetry.addUserContext(req.user);
                    
                    // Add additional context to the request span
                    if (req.telemetrySpan) {
                        req.telemetrySpan.setAttributes({
                            'catalix.user.authenticated': true,
                            'catalix.user.hasGroups': !!(req.user.userGroups && req.user.userGroups.length > 0),
                        });
                    }
                } else {
                    // Mark as anonymous user
                    if (req.telemetrySpan) {
                        req.telemetrySpan.setAttributes({
                            'catalix.user.authenticated': false,
                            'catalix.user.anonymous': true,
                        });
                    }
                }

                // Add passport context if available
                if (req.headers['x-passport']) {
                    telemetry.addPassportContext({
                        present: true,
                        // Don't log the actual passport content for security
                    });
                }

                next();
            } catch (error) {
                telemetry.recordError(error, {
                    'catalix.middleware.error': 'user_context_error',
                });
                console.error('User context telemetry error:', error);
                next(); // Continue even if telemetry fails
            }
        };
    }

    /**
     * Create a custom span for business operations
     * Use this in route handlers for detailed tracing
     */
    static createBusinessSpan(operationName, attributes = {}) {
        const telemetry = getTelemetryUtils();
        return telemetry.createSpan(`catalix.business.${operationName}`, {
            'catalix.operation': operationName,
            'catalix.component': 'business-logic',
            ...attributes,
        });
    }

    /**
     * Utility method to record authentication events
     */
    static recordAuthEvent(eventType, success, details = {}) {
        const telemetry = getTelemetryUtils();
        const span = telemetry.createSpan(`catalix.auth.${eventType}`, {
            'catalix.auth.event': eventType,
            'catalix.auth.success': success,
            'catalix.component': 'authentication',
            ...details,
        });
        
        // End the span immediately as it's an event
        span.end();
        
        return span;
    }

    /**
     * Utility method to record passport validation events
     */
    static recordPassportEvent(eventType, passportData = {}) {
        const telemetry = getTelemetryUtils();
        const span = telemetry.createSpan(`catalix.passport.${eventType}`, {
            'catalix.passport.event': eventType,
            'catalix.component': 'passport-validation',
            'catalix.passport.valid': passportData.valid || false,
            'catalix.passport.hasUserId': !!(passportData.userId),
            'catalix.passport.hasEmail': !!(passportData.email),
        });
        
        span.end();
        return span;
    }
}

module.exports = CatalixTelemetryMiddleware;