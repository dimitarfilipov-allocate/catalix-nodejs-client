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
Create Express middleware that reads the `x-passport` header, deserializes it, validates it, and creates user context for routes.

```javascript
class PassportAuthMiddleware {
    static create(options = {}) {
        const config = {
            required: options.required !== false,
            logRequests: options.logRequests !== false
        };

        return (req, res, next) => {
            try {
                const passportHeader = req.headers['x-passport'] || req.headers['X-Passport'];
                
                if (config.logRequests) {
                    console.log(`🎫 Passport Auth Check - ${req.method} ${req.url}`);
                    console.log(`Passport Header Present: ${!!passportHeader}`);
                }

                if (!passportHeader) {
                    if (config.required) {
                        return res.status(401).json({
                            error: 'Unauthorized',
                            message: 'Missing or invalid x-passport header',
                            code: 'MISSING_PASSPORT'
                        });
                    }
                    req.passport = null;
                    req.user = null;
                    return next();
                }

                const passport = PassportDeserializer.safeDeserialize(passportHeader.trim());

                if (!passport) {
                    if (config.required) {
                        return res.status(401).json({
                            error: 'Unauthorized',
                            message: 'Invalid passport format or signature',
                            code: 'INVALID_PASSPORT'
                        });
                    }
                    req.passport = null;
                    req.user = null;
                    return next();
                }

                if (!passport.isValid()) {
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

    static required(options = {}) {
        return PassportAuthMiddleware.create({ ...options, required: true });
    }

    static optional(options = {}) {
        return PassportAuthMiddleware.create({ ...options, required: false });
    }

    static requireGroups(requiredGroups, options = {}) {
        const groups = Array.isArray(requiredGroups) ? requiredGroups : [requiredGroups];
        
        return [
            PassportAuthMiddleware.required(options),
            (req, res, next) => {
                const userGroups = req.user?.userGroups || [];
                const hasRequiredGroup = groups.some(group => userGroups.includes(group));

                if (!hasRequiredGroup) {
                    return res.status(403).json({
                        error: 'Forbidden',
                        message: `Access denied. Required groups: ${groups.join(', ')}`,
                        code: 'INSUFFICIENT_PERMISSIONS'
                    });
                }
                next();
            }
        ];
    }

    static requireSupportUser(options = {}) {
        return [
            PassportAuthMiddleware.required(options),
            (req, res, next) => {
                if (!req.user?.isSupportUser) {
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
```

---

## 5. Express Server Setup

**Prompt:**  
Show how to set up an Express server with Catalix Passport Authentication, including middleware setup and route protection.

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const { PassportGenerator, PassportDeserializer } = require('./models/PassportUtils');
const PassportAuthMiddleware = require('./middleware/PassportAuthMiddleware');

const app = express();

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Header logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    
    // Log x-passport header presence (don't log content for security)
    if (req.headers['x-passport']) {
        console.log('x-passport: [PASSPORT_PRESENT]');
    }
    
    // Add security headers
    res.set({
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    
    next();
});

// Public routes
app.get('/', (req, res) => {
    res.send('Welcome to Catalix App');
});

// Authentication endpoints
app.post('/start-session', (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).send('Token is required');
        }
        
        const passport = PassportGenerator.createPassportFromIdToken(token);
        return res.send(passport);
        
    } catch (error) {
        console.error('Error processing StartSession:', error);
        return res.status(400).send('Invalid token format');
    }
});

// Protected routes
app.get('/dashboard', PassportAuthMiddleware.required(), (req, res) => {
    res.json({
        message: `Welcome ${req.user.email}`,
        user: req.user
    });
});

app.get('/admin', PassportAuthMiddleware.requireSupportUser(), (req, res) => {
    res.send(`Welcome to admin area, ${req.user.email}!`);
});

app.get('/api/users', PassportAuthMiddleware.requireGroups(['admin', 'users']), (req, res) => {
    res.send(`Users API accessed by ${req.user.email}`);
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
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

// Require specific groups
app.get('/users', PassportAuthMiddleware.requireGroups(['admin', 'users']), handler);

// Require support user
app.get('/admin', PassportAuthMiddleware.requireSupportUser(), handler);

// Optional passport (continues without auth)
app.get('/public', PassportAuthMiddleware.optional(), handler);
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

**Summary:**  
Use these Copilot prompts and code examples to scaffold Catalix Passport Authentication in your Node.js Express project. The implementation follows gateway-forwarded authentication patterns with header-based passport validation, eliminating the need for direct login forms while maintaining robust security and authorization controls.