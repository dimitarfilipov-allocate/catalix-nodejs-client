# Common Authentication (CAP) Passport Authentication for ASP.NET Core

> **CAP (Common Authentication Platform)** is a header-based authentication scheme for ASP.NET Core Razor Pages (and MVC) applications running behind the CAP Authentication gateway. 
The gateway forwards a signed `x-passport` header on every authenticated request; this package validates it and builds a standard `ClaimsPrincipal`.

## Prerequisites

- [.NET SDK](https://dotnet.microsoft.com/download) 8.0 or newer
- Your application deployed behind the CAP Authentication gateway (which injects the `x-passport` header)
- CAP [Local Development Environment](https://github.com/rld-engineering/auth-api-gateway/blob/develop/dev-env/README.md) (stack: Rancher Desktop)

---

## Use AI to Integrate CAP

If you use an AI coding assistant like GitHub Copilot, you can add CAP authentication automatically using custom CAP implementation agent.

Download the Agent and create new folder under root

```bash
your_app_root\.github\agents\common-auth-passport-authentication.agent.md
```

Then ask your AI assistant:

```
Implement CAP Passport Authentication
```

Your AI assistant will automatically install the NuGet package (RLD.CommonAuthentication.Passport) and configure the authentication middleware.
Once completed ask the assistant:
```
Add protected page that will list all User Claims
```
The agent will generate the necesarry code for CAP Passport Authentication and create a new Razor Page that will list all User Claims. Next navigate to following section `Setup the Application to work behind CAP Authentication Gateway`.

---

## Step-by-Step Integration (ASP.NET Core Razor Pages)

### 1. Create a New Razor Pages Project

```bash
dotnet new razor -n MyApp
cd MyApp
```

### 2. Install NuGet Packages

```bash
dotnet add package RLD.CommonAuthentication.Passport
dotnet add package protobuf-net
dotnet add package System.IdentityModel.Tokens.Jwt
```

`protobuf-net` is required for Protobuf serialization of the passport payload. `System.IdentityModel.Tokens.Jwt` is needed to decode the JWT ID token in the `/start-session` endpoint.

### 3. Define a Custom Passport Model *(optional but recommended)*

Subclass `AuthenticationPassport` to add any application-specific fields. Assign `[ProtoMember]` tag numbers that do **not** conflict with the base class (tags 1–5 are reserved).

**Models/AppPassport.cs**
```csharp
using ProtoBuf;
using RLD.CommonAuthentication.Passport.Models;

[ProtoContract]
public class AppPassport : AuthenticationPassport
{
    [ProtoMember(6)] public string Email { get; set; } = string.Empty;
}
```

Note: make sure to register the derived type with the Protobuf runtime model in `Program.cs` (see step 5).

### 4. Add the Passport Generator Service

The `PassportGenerator` converts a JWT ID token (issued by Authentication Service - Auth0) into a CAP passport string. The CAP Authentication gateway calls `/start-session` with this token and forwards the resulting passport as `x-passport` on subsequent requests.

**Services/PassportGenerator.cs**
```csharp
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using RLD.CommonAuthentication.Passport.Models;
using RLD.CommonAuthentication.Passport.Serialization;

public interface IPassportGenerator
{
    string CreatePassportFromIdToken(string idToken);
}

public class PassportGenerator : IPassportGenerator
{
    private readonly ILogger<PassportGenerator> _logger;
    private readonly IPassportSerializer<AppPassport> _passportSerializer;

    public PassportGenerator(ILogger<PassportGenerator> logger, IPassportSerializer<AppPassport> passportSerializer)
    {
        _logger = logger;
        _passportSerializer = passportSerializer;
    }

    public string CreatePassportFromIdToken(string idToken)
    {
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(idToken);

        var passport = new AppPassport
        {
            UserID     = jwt.Claims.FirstOrDefault(c => c.Type == "sub")?.Value ?? string.Empty,
            Email      = jwt.Claims.FirstOrDefault(c => c.Type == "email")?.Value ?? string.Empty,
            UserType   = "Standard",
            UserGroups = jwt.Claims
                .Where(c => c.Type == "groups" || c.Type == ClaimTypes.Role)
                .Select(c => c.Value)
                .ToList()
        };

        _logger.LogInformation("Created passport for user: {UserId}", passport.UserID);
        return _passportSerializer.Serialize(passport);
    }
}
```

### 5. Wire Everything in `Program.cs`

**Program.cs**
```csharp
using Microsoft.AspNetCore.HttpOverrides;
using ProtoBuf.Meta;
using RLD.CommonAuthentication.Passport;
using RLD.CommonAuthentication.Passport.Models;
using RLD.CommonAuthentication.Passport.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Register the derived passport type with the Protobuf runtime model
RuntimeTypeModel.Default[typeof(AuthenticationPassport)]
    .AddSubType(100, typeof(AppPassport));

// Trust forwarded headers from the Catalix reverse proxy
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor |
                               ForwardedHeaders.XForwardedProto |
                               ForwardedHeaders.XForwardedHost;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Register Passport authentication
builder.Services
    .AddAuthentication(PassportAuthenticationDefaults.AuthenticationScheme)
    .AddPassport<AppPassport>(options => { });

// Register application services
builder.Services.AddScoped<IPassportGenerator, PassportGenerator>();
builder.Services.AddScoped<IPassportSerializer<AppPassport>, ProtobufPassportSerializer<AppPassport>>();

builder.Services.AddRazorPages();
builder.Services.AddControllers(); // required for the session API controller

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

// Apply forwarded headers before anything else
app.UseForwardedHeaders();

// Resolve dynamic path base from X-relative-gateway-path header (see step 6)
app.UseDynamicPathBase();

app.MapStaticAssets();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapRazorPages().WithStaticAssets();
app.MapControllers();

app.Run();
```

### 6. Add the `X-relative-gateway-path` Middleware

When the app runs behind the CAP Authentication gateway, the gateway may mount it under a sub-path (e.g. `/myapp`). The `X-relative-gateway-path` header carries that prefix so ASP.NET Core routing and `asp-page` tag helpers resolve correctly.

**Middleware/DynamicPathBaseMiddleware.cs**
```csharp
public class DynamicPathBaseMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<DynamicPathBaseMiddleware> _logger;

    public DynamicPathBaseMiddleware(RequestDelegate next, ILogger<DynamicPathBaseMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue("X-relative-gateway-path", out var pathBaseValue))
        {
            var pathBase = pathBaseValue.ToString().Trim();

            if (!string.IsNullOrEmpty(pathBase))
            {
                if (!pathBase.StartsWith('/'))
                    pathBase = "/" + pathBase;

                if (pathBase.EndsWith('/') && pathBase.Length > 1)
                    pathBase = pathBase.TrimEnd('/');

                _logger.LogDebug("Setting PathBase from X-relative-gateway-path: {PathBase}", pathBase);

                context.Request.PathBase = pathBase;

                // Strip the prefix from Path so routing resolves correctly
                if (context.Request.Path.StartsWithSegments(pathBase, out var remainingPath))
                    context.Request.Path = remainingPath;
            }
        }

        await _next(context);
    }
}

public static class DynamicPathBaseMiddlewareExtensions
{
    public static IApplicationBuilder UseDynamicPathBase(this IApplicationBuilder app)
        => app.UseMiddleware<DynamicPathBaseMiddleware>();
}
```

> **Important:** Call `app.UseDynamicPathBase()` **after** `app.UseForwardedHeaders()` and **before** `app.UseRouting()`.

### 7. Add the Start Session / End Session Endpoints

The CAP Authentication gateway calls `/api/cap-session/start-session` (POST) after the user authenticates to get a CAP passport, and `/api/cap-session/end-session` (POST) when the user logs out.

**Controllers/CapSessionController.cs**
```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

public class PassportRequest
{
    public string Token { get; set; } = string.Empty;
}

[ApiController]
[Route("api/[controller]")]
public class CapSessionController : ControllerBase
{
    private readonly ILogger<CapSessionController> _logger;
    private readonly IPassportGenerator _passportGenerator;

    public CapSessionController(ILogger<CapSessionController> logger, IPassportGenerator passportGenerator)
    {
        _logger = logger;
        _passportGenerator = passportGenerator;
    }

    /// <summary>
    /// Called by the Catalix gateway after the user authenticates.
    /// Converts the JWT ID token into a CAP passport string.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("start-session")]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public IActionResult StartSession([FromBody] PassportRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Token))
            return BadRequest("Token is required");

        try
        {
            var passport = _passportGenerator.CreatePassportFromIdToken(request.Token);
            _logger.LogInformation("StartSession completed successfully");
            return Ok(passport);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "StartSession failed: invalid token format");
            return BadRequest("Invalid token format");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "StartSession failed");
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred");
        }
    }

    /// <summary>
    /// Called by the Catalix gateway when the user logs out.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("end-session")]
    public IActionResult EndSession()
    {
        _logger.LogInformation("EndSession called");
        return Ok();
    }
}
```

### 8. Protect a Razor Page

Decorate any `PageModel` with `[Authorize]` to require a valid `x-passport` header.

**Pages/Claims.cshtml.cs**
```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using RLD.CommonAuthentication.Passport;

[Authorize(AuthenticationSchemes = PassportAuthenticationDefaults.AuthenticationScheme)]
public class ClaimsModel : PageModel
{
    public IEnumerable<(string Type, string Value)> Claims { get; private set; } = [];

    public void OnGet()
    {
        Claims = User.Claims.Select(c => (c.Type, c.Value));
    }
}
```

**Pages/Claims.cshtml**
```razor
@page
@model ClaimsModel
@{ ViewData["Title"] = "User Claims"; }

<h2>User Claims</h2>

<table class="table table-bordered table-striped">
    <thead class="table-dark">
        <tr><th>Type</th><th>Value</th></tr>
    </thead>
    <tbody>
        @foreach (var claim in Model.Claims)
        {
            <tr>
                <td><code>@claim.Type</code></td>
                <td>@claim.Value</td>
            </tr>
        }
    </tbody>
</table>
```

---

## Setup the Application to work behind CAP Authentication Gateway

Once the implementation is complete, navigate to launchSettings.json and make the applicationUrl 0.0.0.0:PORT
instead of localhost:PORT. 
This will make the application accessible from the CAP Authentication Gateway docker container.

in terminal execute: 
```bash
ipconfig
````
and search for WSL network adapter
```bash
Ethernet adapter vEthernet (WSL (Hyper-V firewall)):

   Connection-specific DNS Suffix  . :
   Link-local IPv6 Address . . . . . : fe80::8c00:fba1:19b3:5d39%100
   IPv4 Address. . . . . . . . . . . : 172.30.96.1
   Subnet Mask . . . . . . . . . . . : 255.255.240.0
   Default Gateway . . . . . . . . . :
```

copy the IPv4 address that will be used as application url from CAP Authentication Gateway.

On the CAP Authentication Gateway, add the application configuration by changing following files: catalog.json and services.json located in 

auth-api-gateway\api-gateway\user\data\catalog.json
auth-api-gateway\api-gateway\user\data\services.json

The catalog.json file is used to Route entire traffic from CAP Auth gateway to proxied application (your application) by defining following configuration:

```json
{
  "DEV": {
    "RAZORAPP": {
      "endSessionUrl": "http://172.30.96.1:5272/api/capsession/end-session",
      "startSessionUrl": "http://172.30.96.1:5272/api/capsession/start-session",
      "upstreamUrl": "http://172.30.96.1:5272/@{relative_url}",
      "connections": [{ "id": "Username-Password-Authentication", "name": "Default", "description": "Default", "isActive": true }],
      "auth0Scope": "openid email profile",
      "isFederatedLogout": "false",
      "catalixEnabled": "true",
      "isDefaultService": "false",
      "inactivityTimeout": null
    }
  }
}
```
where the `upstreamUrl` is the URL of your application running on the host machine (the IP address you found earlier) and the port that your application is listening on. The `startSessionUrl` and `endSessionUrl` are the endpoints that you defined in your application for starting and ending sessions.

The services.json is used to define the service configuration for your application. Add the following configuration:
```json
{
  "RAZORAPP": [
    {
      "code": "WEB",
      "isDefault": "true"
    }
  ]
}
```
where the `code` is the name of your application and `isDefault` is set to true to indicate that this is the default service for the application.

Once above configuration is done, restart the CAP Authentication Gateway and your application should now be accessible through the gateway with CAP Passport Authentication enabled.

Execute following url
```bash
http://localhost:30080/DEV/RAZORAPP/web/Claims
```
The request will result with 401 that will immediately trigger Auth Challenge and redirect to CAP Authentication Gateway login page. After successful login, the request will be redirected back to your application with valid x-passport header and the Claims page will be displayed.

---

## How It Works

```
Browser  Catalix Gateway                                  Your App
              |                                               |
              | POST /api/cap-session/start-session           | PassportGenerator converts JWT -> passport string
              | { "token": "<JWT ID token>" }  ------------>  | Returns plain-text passport string
              |                                               |
              | x-passport: v1.<payload>.<sig>                | PassportAuthenticationHandler reads header
              | (every authenticated request) ------------>   | Deserializes -> AppPassport -> ClaimsPrincipal
              |                                               |
              | POST /api/cap-session/end-session             | Logout hook (stateless - return 200)
              |                                               |
              | X-relative-gateway-path: /myapp               | DynamicPathBaseMiddleware sets PathBase
              | (every request)              ------------>    | Routing and tag helpers work under sub-path
```

- **No local login page.** Authentication is handled entirely by the CAP Authentication gateway.
- **`x-passport`** is injected by the gateway on every request for authenticated users.
- **`X-relative-gateway-path`** carries the URL sub-path prefix so `asp-page` links and redirects resolve correctly.

---

## Accessing User Information within Razor Pages

```csharp
using RLD.CommonAuthentication.Passport.Models;
using System.Security.Claims;

// User ID
var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

// Email (if using AppPassport with an Email field)
var email = User.FindFirst("Email")?.Value;

// User type (e.g. "Standard", "Service")
var userType = User.FindFirst(PassportClaimTypes.UserType)?.Value;

// Support user flag
var isSupportUser = User.HasClaim(PassportClaimTypes.IsSupportUser, "true");

// Group memberships
var groups = User.FindAll(PassportClaimTypes.UserGroup).Select(c => c.Value).ToList();

// Strongly-typed passport (when using a custom model)
var identity = User.Identity as PassportIdentity<AppPassport>;
var passport = identity?.Passport; // AppPassport instance
```

## Accessing User Information within CAP Authentication Gateway
There is special endpoint on the platform level "userinfo" that lists all claims for the Authenticated User
```bash
Follow the URL http://CAP_HOST/CUSTOMER_CODE/userinfo
```
---

## Advanced Configuration

### Authentication Events

```csharp
.AddPassport<AppPassport>(options =>
{
    options.Events.OnPassportValidated = context =>
    {
        var claimsIdentity = (ClaimsIdentity)context.Principal!.Identity!;
        claimsIdentity.AddClaim(new Claim("tenant", "acme"));
        return Task.CompletedTask;
    };

    options.Events.OnAuthenticationFailed = context =>
    {
        Console.Error.WriteLine($"Auth failed: {context.Exception.Message}");
        return Task.CompletedTask;
    };

    options.Events.OnMessageReceived = context =>
    {
        // Override token source - e.g. read from query string for local testing
        context.Token = context.HttpContext.Request.Query["passport"];
        return Task.CompletedTask;
    };
});
```

---

## Passport String Format

The `x-passport` header value has the following structure:

```
v1.<Base64(ProtobufBytes)>.<Base64("static.passport.test")>
```

| Part | Description |
|------|-------------|
| `v1` | Version prefix |
| `<Base64(ProtobufBytes)>` | Protobuf-encoded passport payload |
| `<Base64("static.passport.test")>` | Static signature |

### Payload Fields

| Field | Proto tag | Claim type | Description |
|-------|-----------|------------|-------------|
| `UserID` | 1 | `ClaimTypes.NameIdentifier` | Stable user identifier |
| `IsSupportUser` | 2 | `support_user` | Support-level access flag |
| `UserGroups` | 3 | `user_groups` | Group memberships (one claim per group) |
| `OptionalClaims` | 4 | key name | Extensible key/value bag |
| `UserType` | 5 | `user_type` | Account classification |
| *(custom fields)* | 6+ | property name | Fields added by a derived passport type |

---

## Generating a Test Passport

Use `ProtobufPassportSerializer` to create a valid `x-passport` value in unit tests or local development:

```csharp
using RLD.CommonAuthentication.Passport.Models;
using RLD.CommonAuthentication.Passport.Serialization;

var passport = new AppPassport
{
    UserID     = "test-user-123",
    Email      = "test@example.com",
    UserType   = "Standard",
    UserGroups = ["users", "editors"]
};

var serializer = new ProtobufPassportSerializer<AppPassport>();
var passportString = serializer.Serialize(passport);
// Use as: x-passport: <passportString>
```

---

## API Reference

### `PassportAuthenticationDefaults`

| Constant | Value |
|----------|-------|
| `AuthenticationScheme` | `"Passport"` |
| `DisplayName` | `"Common Authentication Passport"` |
| `PassportHeaderName` | `"x-passport"` |

### `PassportAuthenticationOptions<TPassport>`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `HeaderName` | `string` | `"x-passport"` | HTTP header carrying the passport |
| `Serializer` | `IPassportSerializer<TPassport>` | `ProtobufPassportSerializer<TPassport>` | Deserializes the header value |
| `Events` | `PassportAuthenticationEvents<TPassport>` | No-op handlers | Pipeline event hooks |

### `PassportClaimTypes`

| Constant | Claim value | Description |
|----------|-------------|-------------|
| `UserType` | `"user_type"` | Account classification |
| `IsSupportUser` | `"support_user"` | Support-level access |
| `UserGroup` | `"user_groups"` | Group membership |

### `AddPassport` Overloads

```csharp
// Base passport model, default scheme
builder.AddPassport();
builder.AddPassport(options => { ... });

// Custom passport model
builder.AddPassport<AppPassport>(options => { ... });
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `401 Unauthorized` on all requests | Missing or malformed `x-passport` header | Confirm the Catalix gateway is forwarding the header; verify `HeaderName` config |
| `InvalidOperationException: Invalid passport format` | Header is not `v1.<payload>.<sig>` | Ensure the passport is produced by a compatible CAP serializer |
| `Passport signature validation failed` | Signature mismatch | Confirm sender and receiver use the same signature value |
| Claims not resolving | Wrong claim type string | Use `PassportClaimTypes` constants instead of raw strings |
| Custom fields not in `User.Claims` | Derived type not registered in Protobuf | Call `RuntimeTypeModel.Default[typeof(AuthenticationPassport)].AddSubType(...)` before `app.Build()` |
| Razor `asp-page` links broken behind gateway | `PathBase` not set | Ensure `app.UseDynamicPathBase()` is called before `app.UseRouting()` |
