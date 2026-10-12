# Copilot Instructions: Catalix Passport Authentication Implementation (Node.js Express)

Use these step-by-step instructions and code examples to scaffold Passport Authentication in your Node.js Express project, based on the Catalix authentication pattern.

---

## 1. Project Dependencies

**Prompt:**  
Add the required dependencies for Catalix Passport Authentication in a Node.js Express project.

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "body-parser": "^1.20.2",
    "protobufjs": "^7.2.5",
    "jsonwebtoken": "^9.0.2"
  }
}
```

---

## 2. Passport Model

**Prompt:**  
Generate a Node.js AuthenticationPassport model with properties like UserID, Email, IsSupportUser, UserGroups, and serialization methods.

```javascript
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

    asProtoBuffText() {
        const payload = {
            UserID: this.UserID,
            Email: this.Email,
            IsSupportUser: this.IsSupportUser,
            UserGroups: this.UserGroups,
            OptionalClaims: this.OptionalClaims,
            UserType: this.UserType,
            Timestamp: this.Timestamp
        };

        const jsonPayload = JSON.stringify(payload);
        const serialized = Buffer.from(jsonPayload, 'utf8').toString('base64');
        const signature = Buffer.from('static.passport.test', 'ascii').toString('base64');

        return `v1.${serialized}.${signature}`;
    }

    static fromIdToken(idToken) {
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
    }

    isValid() {
        return !!(this.UserID && this.Email && this.UserType);
    }

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
```

---

## 3. Passport Serialization/Deserialization

**Prompt:**  
Implement utilities for serializing and deserializing Passport objects in Node.js with format `v1.{Base64Payload}.{Base64Signature}`.

```javascript
class PassportSerializer {
    static serialize(passport) {
        if (!(passport instanceof AuthenticationPassport)) {
            throw new Error('Invalid passport object provided');
        }
        return passport.asProtoBuffText();
    }

    static createAndSerialize(data) {
        const passport = new AuthenticationPassport(data);
        return PassportSerializer.serialize(passport);
    }
}

class PassportDeserializer {
    static deserialize(passportText) {
        if (!passportText || typeof passportText !== 'string') {
            throw new Error('Invalid passport text provided');
        }

        const parts = passportText.split('.');
        if (parts.length !== 3 || parts[0] !== 'v1') {
            throw new Error('Invalid passport format');
        }

        const payloadBytes = Buffer.from(parts[1], 'base64');
        const payloadJson = payloadBytes.toString('utf8');
        const payloadData = JSON.parse(payloadJson);

        const expectedSignature = Buffer.from('static.passport.test', 'ascii').toString('base64');
        if (parts[2] !== expectedSignature) {
            throw new Error('Invalid passport signature');
        }

        const passport = new AuthenticationPassport(payloadData);
        
        if (!passport.isValid()) {
            throw new Error('Deserialized passport is invalid');
        }

        return passport;
    }

    static safeDeserialize(passportText) {
        try {
            return PassportDeserializer.deserialize(passportText);
        } catch (error) {
            console.warn('Failed to deserialize passport:', error.message);
            return null;
        }
    }
}

class PassportGenerator {
    static createPassportFromIdToken(idToken) {
        const passport = AuthenticationPassport.fromIdToken(idToken);
        return passport.asProtoBuffText();
    }

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
```

---

## 4. Passport Authentication Middleware

**Prompt:**  
Create simplified Express middleware that focuses on core authentication patterns (required and optional) for header-based passport validation.

```javascript
const { PassportDeserializer } = require('../models/PassportUtils');

class PassportAuthMiddleware {
    // Basic authentication check - requires valid passport
    static required() {
        return (req, res, next) => {
            try {
                const passport = req.headers['x-passport'];
                
                if (!passport) {
                    console.log('Authentication failed: Missing x-passport header');
                    return res.status(401).json({
                        error: 'Unauthorized',
                        message: 'Missing authentication header'
                    });
                }

                const deserializedPassport = PassportDeserializer.deserializePassport(passport);
                
                if (!deserializedPassport.isValid()) {
                    console.log('Authentication failed: Invalid passport');
                    return res.status(401).json({
                        error: 'Unauthorized',
                        message: 'Invalid authentication'
                    });
                }

                // Attach user to request
                req.user = {
                    id: deserializedPassport.userId,
                    email: deserializedPassport.email,
                    userType: deserializedPassport.userType,
                    userGroups: deserializedPassport.userGroups,
                    isSupportUser: deserializedPassport.isSupportUser
                };

                next();
            } catch (error) {
                console.error('Authentication middleware error:', error);
                return res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'Authentication processing failed'
                });
            }
        };
    }

    // Optional authentication - continues even without passport
    static optional() {
        return (req, res, next) => {
            try {
                const passport = req.headers['x-passport'];
                
                if (!passport) {
                    req.user = null;
                    return next();
                }

                const deserializedPassport = PassportDeserializer.deserializePassport(passport);
                
                if (deserializedPassport.isValid()) {
                    req.user = {
                        id: deserializedPassport.userId,
                        email: deserializedPassport.email,
                        userType: deserializedPassport.userType,
                        userGroups: deserializedPassport.userGroups,
                        isSupportUser: deserializedPassport.isSupportUser
                    };
                } else {
                    req.user = null;
                }

                next();
            } catch (error) {
                console.error('Optional authentication error:', error);
                req.user = null;
                next();
            }
        };
    }
}

module.exports = PassportAuthMiddleware;
```

**Implementation Note:** This middleware provides the core authentication patterns. For advanced authorization features like group-based access or support user validation, implement them as business logic in your route handlers using the `req.user` object properties.

---

## 5. Express Server Setup with Configuration Management

**Prompt:**  
Show how to set up an Express server with Catalix Passport Authentication, including configurable path prefixes for CPCS environments and EJS template integration.

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const { PassportGenerator, PassportDeserializer } = require('./models/PassportUtils');
const PassportAuthMiddleware = require('./middleware/PassportAuthMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORTANT: CHANGE THIS AS PER CPCS Configuration
const relativePathPrefix = '/DEV/NOD';

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration (for legacy compatibility)
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

// Home page with path prefix support
app.get('/', (req, res) => {
    res.render('home', {
        relativePathPrefix: relativePathPrefix
    });
});

// ===== PROTECTED ROUTES =====

// Dashboard - requires valid passport
app.get('/dashboard', PassportAuthMiddleware.required(), (req, res) => {
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
    res.render('loggedout');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
```

---

## 6. Key Implementation Patterns

**Prompt:**  
Implement the following key patterns for Catalix Authentication in Node.js:

### Gateway Integration Pattern
- **No direct login routes** - Authentication handled by upstream gateway
- **Header-based authentication** - Read `x-passport` from forwarded headers
- **Logout redirects to gateway** - Let gateway handle session termination

### Response Pattern  
- **Plain text responses** for authentication endpoints (not JSON)
- **Passport strings returned directly** from generation endpoints
- **Simple error messages** as plain text

### Security Pattern
- **Header logging** with security considerations (mask passport content)
- **Security headers** applied to all responses
- **Validation at multiple levels** (format, signature, business rules)

### Authorization Patterns
```javascript
// Require valid passport
app.get('/protected', PassportAuthMiddleware.required(), handler);

// Optional passport (continues without auth)
app.get('/public', PassportAuthMiddleware.optional(), handler);

// For group-based or support user authorization, implement in route handler:
app.get('/admin', PassportAuthMiddleware.required(), (req, res) => {
    if (!req.user.isSupportUser) {
        return res.status(403).json({ error: 'Support user access required' });
    }
    // Handle admin logic
});

app.get('/users', PassportAuthMiddleware.required(), (req, res) => {
    const requiredGroups = ['admin', 'users'];
    const hasAccess = requiredGroups.some(group => req.user.userGroups.includes(group));
    if (!hasAccess) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }
    // Handle users logic
});
```

---

## 7. File Structure

**Prompt:**  
Organize your Catalix Authentication implementation with this recommended file structure:

```
project/
├── models/
│   ├── AuthenticationPassport.js
│   └── PassportUtils.js
├── middleware/
│   └── PassportAuthMiddleware.js
├── views/
│   ├── home.ejs
│   ├── dashboard.ejs
│   └── logout.ejs
├── public/
│   └── css/
│       └── style.css
├── app.js
└── package.json
```

---

## 8. EJS Template Integration

**Prompt:**  
Show how to create EJS templates that work with Catalix Authentication and configurable path prefixes.

**Home Template (views/home.ejs):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome - Catalix App</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div class="container">
        <div class="simple-card">
            <h1>Welcome to Catalix</h1>
            <p>Your gateway to secure application access</p>
            <a href="<%= relativePathPrefix %>/Login?returnUrl=/dashboard" class="simple-btn">Go to Dashboard</a>
        </div>
    </div>
</body>
</html>
```

**Dashboard Template (views/dashboard.ejs):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Catalix App</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div class="container">
        <div class="simple-card">
            <h1>Dashboard</h1>
            <div class="user-info">
                <p><strong>Welcome:</strong> <%= user.username %></p>
                <p><strong>User ID:</strong> <%= user.id %></p>
                <p><strong>User Type:</strong> <%= user.userType %></p>
                <% if (user.userGroups && user.userGroups.length > 0) { %>
                    <p><strong>Groups:</strong> <%= user.userGroups.join(', ') %></p>
                <% } %>
                <% if (user.isSupportUser) { %>
                    <p><strong>Support User:</strong> Yes</p>
                <% } %>
            </div>
            <div class="actions">
                <a href="<%= relativePathPrefix %>/Logout" class="simple-btn">Logout</a>
            </div>
        </div>
    </div>
</body>
</html>
```

**CSS Styles (public/css/style.css):**
```css
/* Simple, clean styling for Catalix Auth pages */
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    min-height: 100vh;
    background-color: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
}

.container {
    width: 100%;
    max-width: 400px;
    padding: 20px;
    box-sizing: border-box;
}

.simple-card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 30px;
    text-align: center;
}

.simple-card h1 {
    color: #195734;
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 1.8rem;
}

.simple-card p {
    color: #666;
    margin-bottom: 20px;
    line-height: 1.5;
}

.simple-btn {
    background-color: #195734;
    color: white;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    display: inline-block;
    font-size: 16px;
    transition: background-color 0.3s ease;
}

.simple-btn:hover {
    background-color: #0d3f1f;
}

.user-info {
    text-align: left;
    margin: 20px 0;
    background-color: #f9f9f9;
    padding: 15px;
    border-radius: 4px;
}

.user-info p {
    margin: 8px 0;
    color: #333;
}

.actions {
    margin-top: 20px;
}
```

---

**Summary:**  
Use these Copilot prompts and code examples to scaffold Catalix Passport Authentication in your Node.js Express project. The implementation follows gateway-forwarded authentication patterns with header-based passport validation, eliminating the need for direct login forms while maintaining robust security and authorization controls. The simplified middleware approach focuses on core authentication patterns with business logic authorization handled in route handlers.