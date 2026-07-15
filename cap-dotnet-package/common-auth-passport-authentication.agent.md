# Copilot Instructions: Common Authentication (CAP) Passport Authentication (.NET 8+)

Use these step-by-step instructions and code examples to scaffold Passport Authentication in your ASP.NET project using the `RLD.CommonAuthentication.Passport` NuGet package.

---

## 0. NuGet Package

Add the following package reference to your `.csproj`:

```xml
<PackageReference Include="RLD.CommonAuthentication.Passport" Version="*" />
<PackageReference Include="protobuf-net" Version="3.2.30" />
<PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="8.x" />
```

---

## 1. App Passport Model

**Prompt:**  
Generate a custom `AppPassport` class that inherits from `AuthenticationPassport` (provided by `RLD.CommonAuthentication.Passport`) and adds an `Email` property.

Place this in `Models/AppPassport.cs`:

```csharp
using RLD.CommonAuthentication.Passport.Models;
using ProtoBuf;

namespace YourApp.Models;

[ProtoContract]
public class AppPassport : AuthenticationPassport
{
    [ProtoMember(6)] public string Email { get; set; } = string.Empty;
}
```

> **Note:** The base class `AuthenticationPassport` occupies `ProtoMember` fields 1–5 (UserID, IsSupportUser, UserGroups, UserType, OptionalClaims). Start custom fields at 6.

---

## 2. Passport Generator Service

**Prompt:**  
Implement `IPassportGenerator` and `PassportGenerator` that reads claims from a JWT ID token and produces a serialized passport string.

Place this in `Services/PassportGenerator.cs`:

```csharp
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using RLD.CommonAuthentication.Passport.Models;
using RLD.CommonAuthentication.Passport.Serialization;
using YourApp.Models;

namespace YourApp.Services;

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
        if (string.IsNullOrWhiteSpace(idToken))
            throw new ArgumentException("ID token cannot be null or empty", nameof(idToken));

        try
        {
            var handler = new JwtSecurityTokenHandler();
            var jwtToken = handler.ReadJwtToken(idToken);

            var userId = jwtToken.Claims.FirstOrDefault(c => c.Type == "sub")?.Value
                ?? jwtToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value
                ?? string.Empty;

            var email = jwtToken.Claims.FirstOrDefault(c => c.Type == "email")?.Value
                ?? jwtToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Email)?.Value
                ?? string.Empty;

            var name = jwtToken.Claims.FirstOrDefault(c => c.Type == "name")?.Value
                ?? jwtToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Name)?.Value
                ?? string.Empty;

            var userGroups = jwtToken.Claims
                .Where(c => c.Type == "groups" || c.Type == ClaimTypes.Role)
                .Select(c => c.Value)
                .ToList();

            var passport = new AppPassport
            {
                UserID = userId,
                Email = email,
                IsSupportUser = false,
                UserGroups = userGroups,
                UserType = "Standard",
                OptionalClaims = jwtToken.Claims
                    .Where(c => c.Type != "sub" && c.Type != "email" && c.Type != "groups")
                    .ToDictionary(c => c.Type, c => c.Value)
            };

            _logger.LogInformation("Created passport for user: {UserId}", userId);
            return _passportSerializer.Serialize(passport);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create passport from ID token");
            throw new InvalidOperationException("Failed to process ID token", ex);
        }
    }
}
```

---

## 3. Register Dependencies in Program.cs

**Prompt:**  
Register the Protobuf subtype, passport authentication, and all required services in `Program.cs`.

```csharp
using RLD.CommonAuthentication.Passport;
using RLD.CommonAuthentication.Passport.Models;
using RLD.CommonAuthentication.Passport.Serialization;
using Microsoft.AspNetCore.HttpOverrides;
using ProtoBuf.Meta;
using YourApp.Middleware;
using YourApp.Models;
using YourApp.Services;

var builder = WebApplication.CreateBuilder(args);

// Register the derived passport type with Protobuf runtime model
RuntimeTypeModel.Default[typeof(AuthenticationPassport)]
    .AddSubType(100, typeof(AppPassport));

// Configure forwarded headers for reverse proxy
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor |
                               ForwardedHeaders.XForwardedProto |
                               ForwardedHeaders.XForwardedHost;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Register passport authentication
builder.Services
    .AddAuthentication(PassportAuthenticationDefaults.AuthenticationScheme)
    .AddPassport<AppPassport>(options => { });

// Register application services
builder.Services.AddScoped<IPassportGenerator, PassportGenerator>();
builder.Services.AddScoped<IPassportSerializer<AppPassport>, ProtobufPassportSerializer<AppPassport>>();

builder.Services.AddControllersWithViews();

var app = builder.Build();

// Apply forwarded headers before anything else
app.UseForwardedHeaders();

// Resolve dynamic path base from X-relative-gateway-path header (must be before static files and routing)
app.UseDynamicPathBase();

app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
```

---

## 4. Start Session Endpoint

**Prompt:**  
Implement a `StartSession` endpoint that accepts a JWT ID token, generates a passport, and returns the serialized string.

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YourApp.Services;

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

    [AllowAnonymous]
    [HttpPost("start-session")]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public IActionResult StartSession([FromBody] PassportRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Token))
            {
                _logger.LogWarning("StartSession called with invalid or missing token");
                return BadRequest("Token is required");
            }

            _logger.LogInformation("StartSession attempting to issue passport");

            var passport = _passportGenerator.CreatePassportFromIdToken(request.Token);

            _logger.LogInformation("StartSession completed successfully");
            return Ok(passport);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "StartSession failed due to invalid token format");
            return BadRequest("Invalid token format");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing StartSession request");
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while processing the request");
        }
    }
}
```

---

## 5. Protect Endpoints

**Prompt:**  
Protect a controller or action using the passport authentication scheme.

```csharp
[Authorize(AuthenticationSchemes = PassportAuthenticationDefaults.AuthenticationScheme)]
public IActionResult SecureEndpoint()
{
    // Only accessible with a valid x-passport header
}
```

---

## 6. Dynamic Path Base Middleware (Relative Routing for Static Content)

**Prompt:**  
When the app is hosted behind a reverse proxy under a sub-path (e.g. `/myapp`), the `X-relative-gateway-path` header is used to tell the app what its path base is at runtime. Implement `DynamicPathBaseMiddleware` so that static files, Razor views, and all generated URLs (CSS, JS, `asp-*` tag helpers) resolve correctly relative to that sub-path.

Place this in `Middleware/DynamicPathBaseMiddleware.cs`:

```csharp
namespace YourApp.Middleware;

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

                _logger.LogDebug("Setting PathBase from X-relative-gateway-path header: {PathBase}", pathBase);

                context.Request.PathBase = pathBase;

                // Strip the path base prefix from Path so routing resolves correctly
                if (context.Request.Path.StartsWithSegments(pathBase, out var remainingPath))
                    context.Request.Path = remainingPath;
            }
        }

        await _next(context);
    }
}

public static class DynamicPathBaseMiddlewareExtensions
{
    public static IApplicationBuilder UseDynamicPathBase(this IApplicationBuilder builder)
        => builder.UseMiddleware<DynamicPathBaseMiddleware>();
}
```

> **Why this order matters in `Program.cs`:**
> 
> | Middleware | Must come after |
> |---|---|
> | `UseForwardedHeaders()` | — (first, so `X-*` headers are trusted) |
> | `UseDynamicPathBase()` | `UseForwardedHeaders()` |
> | `UseStaticFiles()` | `UseDynamicPathBase()` — so static files are served relative to the resolved path base |
> | `UseRouting()` | `UseStaticFiles()` |
> | `UseAuthentication()` / `UseAuthorization()` | `UseRouting()` |

> **Razor / Tag Helper support:** Once `PathBase` is set on the request, ASP.NET Core's `asp-src`, `asp-href`, `asp-action`, and `Url.Content("~/...")` helpers automatically prepend the path base, so no changes to views are required.
