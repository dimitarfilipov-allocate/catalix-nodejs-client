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
    res.render('home', {
        relativePathPrefix: relativePathPrefix
    });
});


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
        },
        relativePathPrefix: relativePathPrefix
    });
});

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
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});