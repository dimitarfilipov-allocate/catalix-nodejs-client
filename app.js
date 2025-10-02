const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');

// Catalix Authentication imports
const { PassportGenerator, PassportDeserializer } = require('./models/PassportUtils');
const PassportAuthMiddleware = require('./middleware/PassportAuthMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory user storage (in production, use a database)
const users = [
    {
        id: 1,
        username: 'admin',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' // 'password' hashed
    }
];

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

// Header checking middleware (for logging only, authentication handled per route)
app.use((req, res, next) => {
    // Log request details
    console.log(`\n=== Request Headers Check ===`);
    console.log(`${req.method} ${req.url}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`IP: ${req.ip || req.connection.remoteAddress}`);
    
    // Log important headers
    const importantHeaders = [
        'user-agent',
        'accept',
        'authorization',
        'x-passport',
        'content-type',
        'host',
        'origin',
        'referer'
    ];
    
    console.log('Headers:');
    importantHeaders.forEach(header => {
        if (req.headers[header]) {
            // Don't log full passport content for security
            const value = header === 'x-passport' ? '[PASSPORT_PRESENT]' : req.headers[header];
            console.log(`  ${header}: ${value}`);
        }
    });
    
    // Add security headers to response
    res.set({
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    
    console.log('===========================\n');
    next();
});

// Legacy session-based auth removed - using Catalix Passport Authentication

// ===== CATALIX AUTHENTICATION ENDPOINTS =====

// Start Session endpoint - generates passport from ID token
app.post('/start-session', (req, res) => {
    try {
        const { token } = req.body;
        
        // Validate input
        if (!token || typeof token !== 'string') {
            console.log('StartSession called with invalid or missing token');
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Token is required',
                code: 'MISSING_TOKEN'
            });
        }
        
        console.log('StartSession attempting to issue passport for session');
        
        // Generate passport from JWT ID token
        const passport = PassportGenerator.createPassportFromIdToken(token);
        
        console.log('StartSession completed successfully');
        return res.send(passport);
        
    } catch (error) {
        if (error.message.includes('Invalid JWT format')) {
            console.log('StartSession failed due to invalid token format:', error.message);
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid token format',
                code: 'INVALID_TOKEN_FORMAT'
            });
        }
        
        console.error('Error processing StartSession request:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'An error occurred while processing the request',
            code: 'PROCESSING_ERROR'
        });
    }
});

// ===== PUBLIC ROUTES =====

// Routes that don't require passport authentication
app.get('/', (req, res) => {
    // Home page - public route (authentication handled by individual routes)
    res.render('home');
});

// Login routes removed - Catalix Auth uses gateway forwarded headers

// ===== PROTECTED ROUTES (Passport Authentication Required) =====

// Dashboard - requires valid passport
app.get('/dashboard', PassportAuthMiddleware.required(), (req, res) => {
    // req.user is populated by PassportAuthMiddleware
    res.render('dashboard', { 
        user: {
            username: req.user.email,
            id: req.user.id,
            userType: req.user.userType,
            userGroups: req.user.userGroups,
            isSupportUser: req.user.isSupportUser
        }
    });
});

// Admin endpoint - requires support user
app.get('/admin', PassportAuthMiddleware.requireSupportUser(), (req, res) => {
    res.json({
        message: 'Welcome to admin area',
        user: req.user,
        timestamp: new Date().toISOString()
    });
});

// API endpoint requiring specific groups
app.get('/api/users', PassportAuthMiddleware.requireGroups(['admin', 'users']), (req, res) => {
    res.json({
        users: users.map(u => ({ id: u.id, username: u.username })),
        requestedBy: req.user.email
    });
});

app.get('/logout', (req, res) => {
    res.redirect('/DEV/NOD/Logout');
});

app.get('/logged-out', (req, res) => {
    res.render('loggedout');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});