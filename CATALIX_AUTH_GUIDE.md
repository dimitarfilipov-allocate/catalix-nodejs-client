# Catalix Authentication Implementation

This document provides sample data and examples for testing the Catalix Authentication system.

## Sample JWT Tokens for Testing

### Basic User Token
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEBjYXRhbGl4LmNvbSIsIm5hbWUiOiJUZXN0IFVzZXIiLCJncm91cHMiOlsidXNlcnMiXSwidXNlcl90eXBlIjoic3RhbmRhcmQiLCJpYXQiOjE3Mjc4NjQxMDAsImV4cCI6MTcyNzk1MDUwMH0.abc123
```

### Support User Token
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdXBwb3J0LTQ1NiIsImVtYWlsIjoic3VwcG9ydEBjYXRhbGl4LmNvbSIsIm5hbWUiOiJTdXBwb3J0IFVzZXIiLCJncm91cHMiOlsiYWRtaW4iLCJzdXBwb3J0Il0sInVzZXJfdHlwZSI6InN1cHBvcnQiLCJpc19zdXBwb3J0Ijp0cnVlLCJpYXQiOjE3Mjc4NjQxMDAsImV4cCI6MTcyNzk1MDUwMH0.def456
```

### Admin User Token  
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbi03ODkiLCJlbWFpbCI6ImFkbWluQGNhdGFsaXguY29tIiwibmFtZSI6IkFkbWluIFVzZXIiLCJncm91cHMiOlsiYWRtaW4iLCJ1c2VycyIsInN1cGVyYWRtaW4iXSwidXNlcl90eXBlIjoiYWRtaW4iLCJpc19zdXBwb3J0Ijp0cnVlLCJpYXQiOjE3Mjc4NjQxMDAsImV4cCI6MTcyNzk1MDUwMH0.ghi789
```

## Sample User Data for Demo Passport

### Regular User
```json
{
  "UserID": "user-001",
  "Email": "john.doe@example.com", 
  "IsSupportUser": false,
  "UserGroups": ["users"],
  "UserType": "standard",
  "OptionalClaims": {
    "name": "John Doe",
    "department": "Engineering"
  }
}
```

### Support User
```json
{
  "UserID": "support-002",
  "Email": "jane.support@catalix.com",
  "IsSupportUser": true, 
  "UserGroups": ["support", "admin"],
  "UserType": "support",
  "OptionalClaims": {
    "name": "Jane Support",
    "level": "senior"
  }
}
```

### Admin User  
```json
{
  "UserID": "admin-003",
  "Email": "admin@catalix.com",
  "IsSupportUser": true,
  "UserGroups": ["admin", "users", "support"],  
  "UserType": "admin",
  "OptionalClaims": {
    "name": "System Administrator",
    "permissions": "full"
  }
}
```

## API Endpoints

### Authentication Endpoints
- `POST /start-session` - Generate passport from JWT ID token
- `POST /demo-passport` - Generate demo passport for testing
- `POST /validate-passport` - Validate passport format and signature

### Protected Endpoints
- `GET /dashboard` - Requires valid passport
- `GET /admin` - Requires support user passport  
- `GET /api/users` - Requires user in 'admin' or 'users' groups

### Testing Endpoints
- `GET /auth-test` - Interactive testing interface

## Usage Examples

### Generate Demo Passport
```javascript
fetch('/demo-passport', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
        userData: {
            UserID: "test-123",
            Email: "test@example.com",
            UserType: "demo"
        }
    })
});
```

### Call Protected API
```javascript
fetch('/dashboard', {
    headers: { 
        'x-passport': 'v1.eyJ...passport_string_here...'
    }
});
```

## Testing Steps

1. **Visit** `http://localhost:3000/auth-test`
2. **Generate** a demo passport or convert a JWT token
3. **Validate** the passport to see user information
4. **Test** protected endpoints with the passport
5. **Try** different user types (standard, support, admin) to see access control

## Passport Format

Catalix passports use the format: `v1.{Base64Payload}.{Base64Signature}`

- **v1** - Version identifier
- **Base64Payload** - JSON user data encoded as base64
- **Base64Signature** - Static signature for validation (use proper signing in production)