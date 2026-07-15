# Common Authentication Passport Authentication for ASP.NET Core

> **CAP (Common Authentication Passport)** is a header-based authentication scheme for ASP.NET Core MVC and Razor Pages applications operating behind the Catalix gateway. The gateway forwards a signed `x-passport` header on every authenticated request; this package validates it and builds a standard `ClaimsPrincipal`.

## Prerequisites

- [.NET SDK](https://dotnet.microsoft.com/download) 8.0 or newer
- An ASP.NET Core MVC or Razor Pages project
- CAP Developer enviornment installed and fully operational
- Application deployed behind the CAP gateway (which injects the `x-passport` header)

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

---

## Get Started

### 1. Install the Package

```bash
dotnet add package RLD.CommonAuthentication.Passport
```

### 2. Configure Authentication

Update your `Program.cs` to register the Passport authentication scheme:

**Program.cs**
```csharp
using RLD.CommonAuthentication.Passport;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication(PassportAuthenticationDefaults.AuthenticationScheme)
    .AddPassport();

builder.Services.AddAuthorization();
builder.Services.AddControllersWithViews(); // or AddRazorPages()

var app = builder.Build();

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
```

> **How it works:** The handler reads the `x-passport` header on every request, deserializes it using Protobuf, and builds a `ClaimsPrincipal` from the passport's fields. No login redirect is needed — authentication is handled upstream by the Catalix gateway.

### 3. Protect Endpoints

#### MVC Controller

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[Authorize]
public class DashboardController : Controller
{
    public IActionResult Index()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        ViewBag.UserId = userId;
        return View();
    }
}
```

#### Razor Pages

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

[Authorize]
public class DashboardModel : PageModel
{
    public string? UserId { get; private set; }

    public void OnGet()
    {
        UserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
    }
}
```

#### Minimal API

```csharp
app.MapGet("/dashboard", (HttpContext ctx) =>
{
    var userId = ctx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    return Results.Ok(new { userId });
}).RequireAuthorization();
```

### 4. Access User Information

The deserialized passport is available as standard `ClaimsPrincipal` claims. Use the `PassportClaimTypes` constants for type-safe access:

```csharp
using RLD.CommonAuthentication.Passport.Models;

// User ID (ClaimTypes.NameIdentifier)
var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

// User type (e.g. "standard", "service", "demo")
var userType = User.FindFirst(PassportClaimTypes.UserType)?.Value;

// Support user flag
var isSupportUser = User.HasClaim(PassportClaimTypes.IsSupportUser, "true");

// Group memberships
var groups = User.FindAll(PassportClaimTypes.UserGroup).Select(c => c.Value).ToList();
```

### 5. Implement Login and Logout

CAP does not use a local login page. Authentication is handled by the Catalix gateway, which issues the `x-passport` header. Your application only needs to redirect to the gateway's login/logout URLs.

#### MVC AccountController

```csharp
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;

public class AccountController : Controller
{
    private readonly string _gatewayBaseUrl;

    public AccountController(IConfiguration config)
    {
        _gatewayBaseUrl = config["Catalix:GatewayBaseUrl"] ?? string.Empty;
    }

    // Redirect to gateway login — the gateway will inject x-passport on the way back
    public IActionResult Login(string returnUrl = "/")
    {
        return Redirect($"{_gatewayBaseUrl}/Login?returnUrl={Uri.EscapeDataString(returnUrl)}");
    }

    // Sign out of the local cookie, then redirect to gateway logout
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync();
        return Redirect($"{_gatewayBaseUrl}/Logout");
    }
}
```

#### Razor Pages (Pages/Account/Logout.cshtml.cs)

```csharp
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

public class LogoutModel : PageModel
{
    private readonly string _gatewayBaseUrl;

    public LogoutModel(IConfiguration config)
    {
        _gatewayBaseUrl = config["Catalix:GatewayBaseUrl"] ?? string.Empty;
    }

    public async Task<IActionResult> OnGetAsync()
    {
        await HttpContext.SignOutAsync();
        return Redirect($"{_gatewayBaseUrl}/Logout");
    }
}
```

### 6. Add Navigation Links

#### Shared Layout (`Views/Shared/_Layout.cshtml` or `Pages/Shared/_Layout.cshtml`)

```html
@if (User.Identity?.IsAuthenticated == true)
{
    <span>Hello, @User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value</span>
    <a asp-controller="Account" asp-action="Logout">Sign out</a>
}
else
{
    <a asp-controller="Account" asp-action="Login">Sign in</a>
}
```

---

## Advanced Configuration

### Custom Passport Model

Subclass `AuthenticationPassport` to add domain-specific fields. Decorate extra properties with `[ProtoMember]` and register a matching serializer:

```csharp
using ProtoBuf;
using RLD.CommonAuthentication.Passport.Models;

[ProtoContract]
public class MyPassport : AuthenticationPassport
{
    [ProtoMember(10)] public string Department { get; set; } = string.Empty;
    [ProtoMember(11)] public string CostCenter { get; set; } = string.Empty;
}
```

Register it in `Program.cs`:

```csharp
using RLD.CommonAuthentication.Passport.Serialization;

builder.Services.AddAuthentication(PassportAuthenticationDefaults.AuthenticationScheme)
    .AddPassport<MyPassport>(options => { });
```

Access the strongly-typed passport from your controller or page:

```csharp
using RLD.CommonAuthentication.Passport.Models;

var identity = (PassportIdentity<MyPassport>?)User.Identity;
var department = identity?.Passport.Department;
```

### Role-Based Authorization

Use standard ASP.NET Core authorization policies based on `UserGroups`:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireClaim(PassportClaimTypes.UserGroup, "admin"));

    options.AddPolicy("SupportOnly", policy =>
        policy.RequireClaim(PassportClaimTypes.IsSupportUser, "true"));
});
```

Apply the policy:

```csharp
[Authorize(Policy = "AdminOnly")]
public IActionResult AdminPanel() => View();
```

### Authentication Events

Hook into the authentication pipeline using `PassportAuthenticationEvents`:

```csharp
builder.Services.AddAuthentication(PassportAuthenticationDefaults.AuthenticationScheme)
    .AddPassport(options =>
    {
        options.Events.OnPassportValidated = context =>
        {
            // Enrich claims after the passport is validated
            var identity = (System.Security.Claims.ClaimsIdentity)context.Principal!.Identity!;
            identity.AddClaim(new System.Security.Claims.Claim("custom_claim", "value"));
            return Task.CompletedTask;
        };

        options.Events.OnAuthenticationFailed = context =>
        {
            // Log or handle authentication failures
            Console.Error.WriteLine($"Auth failed: {context.Exception.Message}");
            return Task.CompletedTask;
        };

        options.Events.OnMessageReceived = context =>
        {
            // Override the token source — e.g. read from a query string for testing
            context.Token = context.HttpContext.Request.Query["passport"];
            return Task.CompletedTask;
        };
    });
```

---

## Passport String Format

The `x-passport` header value follows this format:

```
v1.<Base64(ProtobufBytes)>.<Base64("static.passport.test")>
```

| Part | Description |
|------|-------------|
| `v1` | Version prefix |
| `<Base64(ProtobufBytes)>` | Protobuf-encoded passport payload |
| `<Base64("static.passport.test")>` | Static signature for integrity verification |

### Passport Payload Fields

| Field | Type | Claim Type | Description |
|-------|------|------------|-------------|
| `UserID` | `string` | `ClaimTypes.NameIdentifier` | Unique, stable user identifier |
| `IsSupportUser` | `bool` | `PassportClaimTypes.IsSupportUser` (`support_user`) | Support-level privileges flag |
| `UserGroups` | `List<string>` | `PassportClaimTypes.UserGroup` (`user_groups`) | Role/group memberships |
| `UserType` | `string` | `PassportClaimTypes.UserType` (`user_type`) | Account classification |
| `OptionalClaims` | `Dictionary<string,string>` | key name | Extensible key/value claims |

---

## Generating a Test Passport

Use `ProtobufPassportSerializer` to generate a test passport string in unit tests or development:

```csharp
using RLD.CommonAuthentication.Passport.Models;
using RLD.CommonAuthentication.Passport.Serialization;

var passport = new AuthenticationPassport
{
    UserID = "test-user-123",
    UserType = "standard",
    IsSupportUser = false,
    UserGroups = ["users", "editors"],
    OptionalClaims = new Dictionary<string, string> { ["tenant"] = "acme" }
};

var serializer = new ProtobufPassportSerializer();
var passportString = serializer.Serialize(passport);

// Use passportString as the x-passport header value in tests
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
| `Serializer` | `IPassportSerializer<TPassport>` | `ProtobufPassportSerializer` | Deserializes the raw header value |
| `Events` | `PassportAuthenticationEvents<TPassport>` | No-op handlers | Event hooks for the auth pipeline |

### `PassportClaimTypes`

| Constant | Value | Description |
|----------|-------|-------------|
| `UserType` | `"user_type"` | Account classification |
| `IsSupportUser` | `"support_user"` | Support-level access flag |
| `UserGroup` | `"user_groups"` | Group membership (issued per group) |

### Extension Methods (`AddPassport`)

```csharp
// Default scheme, base passport model
builder.AddPassport();
builder.AddPassport(options => { ... });

// Custom scheme name
builder.AddPassport("MyScheme", options => { ... });

// Custom passport model
builder.AddPassport<MyPassport>(options => { ... });
builder.AddPassport<MyPassport>("MyScheme", options => { ... });
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `401 Unauthorized` on all requests | Missing or malformed `x-passport` header | Ensure the Catalix gateway is forwarding the header; check `HeaderName` config |
| `InvalidOperationException: Invalid passport format` | Header value is not in `v1.<payload>.<sig>` format | Verify the passport is generated by a compatible CAP implementation |
| `Passport signature validation failed` | Signature segment mismatch | Confirm sender and receiver use the same signature scheme |
| Claims missing in `User` | Accessing wrong claim type URI | Use `PassportClaimTypes` constants instead of raw strings |
| Custom fields not in claims | Derived type not registered | Use `AddPassport<MyPassport>` with a matching `ProtobufPassportSerializer<MyPassport>` |
