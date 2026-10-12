---
name: catalix-authentication
description: 'Scaffold Catalix Passport Authentication (CAP) in Node.js Express or ASP.NET projects. Use for: implementing x-passport header-based authentication; creating AuthenticationPassport models; setting up PassportAuthMiddleware (required/optional); generating passport from JWT ID tokens; wiring up /start-session endpoint; protecting Express routes; configuring CPCS path prefixes; creating EJS dashboard/home views. Covers both Node.js (Express) and .NET 6/8 (ASP.NET Core) implementations.'
argument-hint: 'nodejs | dotnet'
---

# Catalix Passport Authentication (CAP)

## When to Use

- Adding authentication to a Node.js Express or ASP.NET Core project using the Catalix gateway pattern
- Implementing `x-passport` header validation middleware
- Generating or deserializing passport strings in `v1.{Base64Payload}.{Base64Signature}` format
- Setting up the `/start-session` endpoint that converts a JWT ID token into a passport
- Protecting routes with `PassportAuthMiddleware.required()` or `PassportAuthMiddleware.optional()`
- Configuring CPCS `relativePathPrefix` for login/logout redirects

---

## Implementation: Node.js Express

Follow the steps in [catalix-authentication-nodejs-instructions.md](../agents/catalix-authentication-nodejs-instructions.md).

### Quick Summary

1. **Install dependencies** — `express`, `body-parser`, `protobufjs`, `jsonwebtoken`
2. **Create `models/AuthenticationPassport.js`** — model with `UserID`, `Email`, `IsSupportUser`, `UserGroups`, `UserType`, `OptionalClaims`; includes `asProtoBuffText()`, `fromIdToken()`, `isValid()`, `getClaims()`
3. **Create `models/PassportUtils.js`** — `PassportSerializer`, `PassportDeserializer`, `PassportGenerator` classes
4. **Create `middleware/PassportAuthMiddleware.js`** — `required()` and `optional()` static factory methods; reads `x-passport` header and attaches `req.user`
5. **Wire `app.js`** — configure `relativePathPrefix`, register `/start-session` (POST), protect `/dashboard` with `PassportAuthMiddleware.required()`, add `/logout` redirect
6. **Create EJS views** — `home.ejs` (login link using `relativePathPrefix`), `dashboard.ejs` (user info + logout), `loggedout.ejs`

### Key Patterns

| Pattern | Detail |
|---------|--------|
| No direct login routes | Authentication handled by upstream Catalix gateway |
| Header auth | Read `x-passport` from forwarded request headers |
| Logout | Redirect to `${relativePathPrefix}/Logout` |
| `/start-session` | Accepts `{ token }` body, returns plain-text passport string |
| Group/support authorization | Implement in route handlers using `req.user.userGroups` / `req.user.isSupportUser` |

### File Structure

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
│   └── loggedout.ejs
├── public/css/style.css
├── app.js
└── package.json
```

---

## Implementation: ASP.NET Core (.NET 6/8)

Follow the steps in [common-auth-csharp.agent.md](../agents/common-auth-csharp.agent.md).

### Quick Summary

1. **`AuthenticationPassport` model** — Protobuf-annotated class with `AsProtoBuffText()`
2. **`PassportSerializer`** — serialize passport to `v1.{Base64Payload}.{Base64Signature}`
3. **`PassportDeserializer`** — deserialize and validate the passport string
4. **`AuthenticationPassportHandler`** — `AuthenticationHandler<AuthenticationSchemeOptions>` that reads `x-passport` header and builds `ClaimsPrincipal`
5. **Register scheme** — `builder.Services.AddAuthentication("Passport").AddScheme<...>("Passport", null)`
6. **`/start-session` endpoint** — `[AllowAnonymous]` POST, calls `passportGenerator.CreatePassportFromIdToken(request.token)`, returns `Ok(passport)`
7. **Protect endpoints** — `[Authorize(AuthenticationSchemes = "Passport")]`

---

## Passport String Format

```
v1.<Base64(JSON payload)>.<Base64("static.passport.test")>
```

- **Version prefix**: `v1`
- **Payload**: Base64-encoded JSON with `UserID`, `Email`, `IsSupportUser`, `UserGroups`, `UserType`, `Timestamp`, `OptionalClaims`
- **Signature**: Base64 of the string `static.passport.test`

---

## Authorization Examples (Node.js)

```javascript
// Require valid passport
app.get('/protected', PassportAuthMiddleware.required(), handler);

// Optional passport
app.get('/public', PassportAuthMiddleware.optional(), handler);

// Support user only
app.get('/admin', PassportAuthMiddleware.required(), (req, res) => {
    if (!req.user.isSupportUser) return res.status(403).json({ error: 'Forbidden' });
    // ...
});

// Group-based
app.get('/users', PassportAuthMiddleware.required(), (req, res) => {
    const hasAccess = ['admin', 'users'].some(g => req.user.userGroups.includes(g));
    if (!hasAccess) return res.status(403).json({ error: 'Insufficient permissions' });
    // ...
});
```

---
name: roll-dice
description: Roll dice using a random number generator. Use when asked to roll a die (d6, d20, etc.), roll dice, or generate a random dice roll.
---

To roll a die, use the following command that generates a random number from 1
to the given number of sides:

```bash
echo $((RANDOM % <sides> + 1))
```

```powershell
Get-Random -Minimum 1 -Maximum (<sides> + 1)
```

Replace `<sides>` with the number of sides on the die (e.g., 6 for a standard
die, 20 for a d20).
