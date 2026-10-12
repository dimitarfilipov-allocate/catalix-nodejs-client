// Initialize OpenTelemetry BEFORE any other imports
const { init: initTelemetry, getTelemetryUtils, shutdown: shutdownTelemetry } = require('./telemetry');

// Initialize telemetry
const telemetrySDK = initTelemetry();

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');

// Catalix Authentication imports
const { PassportGenerator, PassportDeserializer } = require('./models/PassportUtils');
const PassportAuthMiddleware = require('./middleware/PassportAuthMiddleware');
const CatalixTelemetryMiddleware = require('./middleware/CatalixTelemetryMiddleware');

// Get telemetry utilities
const telemetry = getTelemetryUtils();

const app = express();
const PORT = process.env.PORT || 3000;

//****IMPORTANT: CHANGE THIS AS PER CPCS Configuration */
const relativePathPrefix = '/DEV/NOD';

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true in production with HTTPS
}));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Add Catalix telemetry middleware early in the stack
app.use(CatalixTelemetryMiddleware.enhance());


// ===== CATALIX AUTHENTICATION ENDPOINTS =====

// Start Session endpoint - generates passport from ID token
app.post('/start-session', (req, res) => {
    const sessionSpan = CatalixTelemetryMiddleware.createBusinessSpan('start-session', {
        'catalix.endpoint': 'start-session',
        'catalix.auth.flow': 'jwt-to-passport',
    });

    try {
        const { token } = req.body;
        console.log('Received StartSession request with token:', token, new Date().toISOString());

        // Validate input
        if (!token || typeof token !== 'string') {
            console.log('StartSession called with invalid or missing token');
            
            CatalixTelemetryMiddleware.recordAuthEvent('start-session', false, {
                'catalix.error.reason': 'missing-token',
            });

            sessionSpan.setAttributes({
                'catalix.validation.success': false,
                'catalix.error.type': 'missing-token',
            });

            return res.status(400).json({
                error: 'Bad Request',
                message: 'Token is required',
                code: 'MISSING_TOKEN'
            });
        }
        
        console.log('StartSession attempting to issue passport for session');
        sessionSpan.setAttributes({
            'catalix.validation.success': true,
            'catalix.token.present': true,
        });
        
        // Generate passport from JWT ID token
        const passport = PassportGenerator.createPassportFromIdToken(token);
        
        console.log('StartSession completed successfully');
        
        CatalixTelemetryMiddleware.recordAuthEvent('start-session', true, {
            'catalix.passport.generated': true,
        });

        sessionSpan.setAttributes({
            'catalix.passport.creation.success': true,
        });

        return res.send(passport);
        
    } catch (error) {
        telemetry.recordError(error, {
            'catalix.operation': 'start-session',
        });

        if (error.message.includes('Invalid JWT format')) {
            console.log('StartSession failed due to invalid token format:', error.message);
            
            CatalixTelemetryMiddleware.recordAuthEvent('start-session', false, {
                'catalix.error.reason': 'invalid-jwt-format',
            });

            sessionSpan.setAttributes({
                'catalix.token.valid': false,
                'catalix.error.type': 'invalid-jwt-format',
            });

            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid token format',
                code: 'INVALID_TOKEN_FORMAT'
            });
        }
        
        console.error('Error processing StartSession request:', error);
        
        CatalixTelemetryMiddleware.recordAuthEvent('start-session', false, {
            'catalix.error.reason': 'processing-error',
        });

        sessionSpan.setAttributes({
            'catalix.processing.success': false,
            'catalix.error.type': 'processing-error',
        });

        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'An error occurred while processing the request',
            code: 'PROCESSING_ERROR'
        });
    } finally {
        sessionSpan.end();
    }
});

// ===== PUBLIC ROUTES =====

// Routes that don't require passport authentication
app.get('/', (req, res) => {
    // Home page - public route (authentication handled by individual routes)
    res.render('home', {
        relativePathPrefix: relativePathPrefix
    });
});


// ===== PROTECTED ROUTES (Passport Authentication Required) =====

// Dashboard - requires valid passport
app.get('/dashboard', 
    PassportAuthMiddleware.required(), 
    CatalixTelemetryMiddleware.addUserContext(),
    (req, res) => {
        // Create a business span for dashboard rendering
        const dashboardSpan = CatalixTelemetryMiddleware.createBusinessSpan('dashboard.render', {
            'catalix.dashboard.userType': req.user.userType,
            'catalix.dashboard.hasGroups': !!(req.user.userGroups && req.user.userGroups.length > 0),
        });

        try {
            // req.user is populated by PassportAuthMiddleware
            res.render('dashboard', { 
                user: {
                    username: req.user.email,
                    id: req.user.id,
                    userType: req.user.userType,
                    userGroups: req.user.userGroups,
                    isSupportUser: req.user.isSupportUser
                },
                relativePathPrefix: relativePathPrefix
            });

            dashboardSpan.setAttributes({
                'catalix.dashboard.rendered': true,
            });
        } catch (error) {
            telemetry.recordError(error, {
                'catalix.operation': 'dashboard.render',
            });
            throw error;
        } finally {
            dashboardSpan.end();
        }
    }
);

// Logout route - redirects to Catalix Auth logout
app.get('/logout', (req, res) => {
    res.redirect(`${relativePathPrefix}/Logout`);
});

// Logged out confirmation page
app.get('/logged-out', (req, res) => {
    res.render('loggedout', {
        relativePathPrefix: relativePathPrefix
    });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('HTTP server closed');
        shutdownTelemetry();
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('HTTP server closed');
        shutdownTelemetry();
        process.exit(0);
    });
});