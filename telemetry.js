const { NodeSDK } = require('@opentelemetry/sdk-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-http');
const { trace, SpanKind } = require('@opentelemetry/api');

// Configure the OpenTelemetry SDK
const init = () => {
    // Create OTLP trace exporter - configure endpoint as needed
    const traceExporter = new OTLPTraceExporter({
        // Default endpoint is http://localhost:4318/v1/traces
        // Uncomment and modify if using a different endpoint:
        // url: 'http://your-otel-collector:4318/v1/traces',
        
        // Add headers if authentication is required:
        // headers: {
        //     'Authorization': 'Bearer your-token',
        // },
    });

    // Create the SDK with instrumentation and resource information
    const sdk = new NodeSDK({
        resource: resourceFromAttributes({
            [SemanticResourceAttributes.SERVICE_NAME]: 'catalix-nodejs-client',
            [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
            [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
        }),
        traceExporter: traceExporter,
        instrumentations: [
            // HTTP instrumentation for outgoing HTTP requests
            new HttpInstrumentation({
                // Enhance HTTP spans with additional information
                requestHook: (span, request) => {
                    span.setAttributes({
                        'http.request.header.user-agent': request.getHeader?.('user-agent') || 'unknown',
                        'catalix.client.type': 'nodejs',
                    });
                },
                responseHook: (span, response) => {
                    // Add response-specific attributes
                    if (response.statusCode >= 400) {
                        span.setAttributes({
                            'http.response.error': true,
                        });
                    }
                },
                // Ignore health check and telemetry endpoints
                ignoreIncomingRequestHook: (req) => {
                    const ignorePaths = ['/health', '/metrics', '/favicon.ico'];
                    return ignorePaths.some(path => req.url?.startsWith(path));
                },
                ignoreOutgoingRequestHook: (options) => {
                    // Ignore telemetry export requests to prevent circular tracing
                    return options.hostname?.includes('localhost') && options.port === 4318;
                },
            }),
            // Express instrumentation for incoming HTTP requests
            new ExpressInstrumentation({
                // Enhance Express spans
                requestHook: (span, info) => {
                    span.setAttributes({
                        'express.route': info.route || 'unknown',
                        'catalix.framework': 'express',
                    });
                },
            }),
        ],
    });

    // Initialize the SDK
    sdk.start();
    
    console.log('🔍 OpenTelemetry initialized successfully');
    console.log(`📊 Trace export endpoint: ${traceExporter.url || 'http://localhost:4318/v1/traces'}`);
    
    return sdk;
};

// Utility functions for custom instrumentation
const getTelemetryUtils = () => {
    const tracer = trace.getTracer('catalix-nodejs-client', '1.0.0');
    
    return {
        tracer,
        
        // Create a custom span for business logic
        createSpan: (name, attributes = {}) => {
            return tracer.startSpan(name, {
                kind: SpanKind.INTERNAL,
                attributes: {
                    'catalix.component': 'business-logic',
                    ...attributes,
                },
            });
        },
        
        // Add user context to current span
        addUserContext: (user) => {
            const activeSpan = trace.getActiveSpan();
            if (activeSpan && user) {
                activeSpan.setAttributes({
                    'catalix.user.id': user.id || 'unknown',
                    'catalix.user.email': user.email || 'unknown',
                    'catalix.user.type': user.userType || 'unknown',
                    'catalix.user.isSupportUser': user.isSupportUser || false,
                    'catalix.user.groupCount': user.userGroups?.length || 0,
                });
            }
        },
        
        // Add passport context to current span
        addPassportContext: (passport) => {
            const activeSpan = trace.getActiveSpan();
            if (activeSpan && passport) {
                activeSpan.setAttributes({
                    'catalix.passport.present': true,
                    'catalix.passport.valid': passport.isValid?.() || false,
                });
            }
        },
        
        // Record an error in the current span
        recordError: (error, attributes = {}) => {
            const activeSpan = trace.getActiveSpan();
            if (activeSpan) {
                activeSpan.recordException(error);
                activeSpan.setAttributes({
                    'error': true,
                    'error.name': error.name,
                    'error.message': error.message,
                    ...attributes,
                });
            }
        },
    };
};

// Graceful shutdown
const shutdown = async () => {
    console.log('🔍 Shutting down OpenTelemetry...');
    // The SDK will handle cleanup automatically
};

module.exports = {
    init,
    getTelemetryUtils,
    shutdown,
};