# Copilot Instructions: Catalix Passport Authentication Implementation (.NET 6/8)

Use these step-by-step instructions and code examples to scaffold Passport Authentication in your ASP.NET project.

---

## 1. Passport Model

**Prompt:**  
Generate a Protobuf model for Passport with properties like UserID, Email, IsSupportUser, UserGroups, and any additional claims.

```
using ProtoBuf;
using System.Collections.Generic;

[ProtoContract]
public class AuthenticationPassport {
    [ProtoMember(1)] public string UserID { get; set; }
    [ProtoMember(2)] public string Email { get; set; }
    [ProtoMember(3)] public bool IsSupportUser { get; set; }
    [ProtoMember(4)] public IEnumerable<string> UserGroups { get; set; }
    [ProtoMember(5)] public Dictionary<string, string> OptionalClaims { get; set; } = new();
    [ProtoMember(6)] public string UserType { get; set; }

    public string AsProtoBuffText() {
            using (var stream = new MemoryStream()) {
                Serializer.Serialize(stream, this);

                var serialized = Convert.ToBase64String(stream.ToArray());
                var signature = Convert.ToBase64String(Encoding.ASCII.GetBytes("static.passport.test"));

                return $"v1.{serialized}.{signature}";
            }
        }
}
```

---

## 2. Passport Serialization

**Prompt:**  
Implement a method to serialize the Passport model to a Protobuf text string in the format: `v1.{Base64Payload}.{Base64Signature}`

```
using ProtoBuf;
using System;
using System.IO;
using System.Text;

public static class PassportSerializer {
    public static string Serialize(AuthenticationPassport passport) {
        using var stream = new MemoryStream();
        Serializer.Serialize(stream, passport);
        var payload = Convert.ToBase64String(stream.ToArray());
        var signature = Convert.ToBase64String(Encoding.ASCII.GetBytes("static.passport.test"));
        return $"v1.{payload}.{signature}";
    }
}
```

---

## 3. Passport Deserialization

**Prompt:**  
Implement a method to deserialize a Passport Protobuf text string back to the Passport model.

```
using ProtoBuf;
using System;
using System.IO;

public static class PassportDeserializer {
    public static AuthenticationPassport Deserialize(string passportText) {
        var parts = passportText.Split('.');
        if (parts.Length != 3 || parts[0] != "v1")
            throw new InvalidOperationException("Invalid passport format");
        var payloadBytes = Convert.FromBase64String(parts[1]);
        using var ms = new MemoryStream(payloadBytes);
        return Serializer.Deserialize<AuthenticationPassport>(ms);
    }
}
```

---

## 4. Passport Authentication Handler

**Prompt:**  
Create an ASP.NET Core AuthenticationHandler that:
- Reads the `x-passport` header from requests
- Deserializes the header value into a Passport model
- Validates the model
- Creates a ClaimsPrincipal and authenticates the request
- Returns 401 if the header is missing or invalid

```
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using System.Security.Claims;
using System.Threading.Tasks;

public class AuthenticationPassportHandler : AuthenticationHandler<AuthenticationSchemeOptions> {
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync() {
        string passportHeader = Request.Headers["x-passport"];
        if (string.IsNullOrWhiteSpace(passportHeader)) {
            return AuthenticateResult.Fail("Missing or invalid x-passport header.");
        }

        AuthenticationPassport passport;
        try {
            passport = PassportDeserializer.Deserialize(passportHeader.Trim());
        } catch {
            return AuthenticateResult.Fail("Invalid passport format.");
        }

        // Optionally validate passport properties here

        var claims = new List<Claim> {
            new Claim(ClaimTypes.NameIdentifier, passport.UserID),
            new Claim(ClaimTypes.Email, passport.Email)
            // Add more claims as needed
        };

        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme.Name));
        var ticket = new AuthenticationTicket(principal, Scheme.Name);
        return AuthenticateResult.Success(ticket);
    }
}
```

---

## 5. Register the Handler

**Prompt:**  
Show how to register the custom authentication scheme in ASP.NET Core Startup/Program.cs.

```
builder.Services.AddAuthentication("Passport")
    .AddScheme<AuthenticationSchemeOptions, StudentTrackPassportHandler>("Passport", null);
```

---

## 6. Create Start Session Endpoint

**Prompt:**  
Demonstrates how to implement Start Session endpoint that will call the Passport Generator method and return a Passport based on the Id Token provided.

```
[AllowAnonymous]
[HttpPost("start-session")]
[ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status400BadRequest)]
[ProducesResponseType(StatusCodes.Status500InternalServerError)]
public IActionResult StartSession([FromBody] PassportRequest request) {
	try {
		// Validate input
		if (request == null || string.IsNullOrWhiteSpace(request.token)) {
			logger.LogWarning("StartSession called with invalid or missing token");
			return BadRequest("Token is required");
		}

		// Log headers for debugging (excluding sensitive data)
		LogAllHeaders("StartSession");
				
		logger.LogInformation("StartSession attempting to issue passport for session");
				
		// Generate passport from JWT ID token
		var passport = passportGenerator.CreatePassportFromIdToken(request.token);
				
		logger.LogInformation("StartSession completed successfully");
		return Ok(passport);
	}
	catch (ArgumentException ex) {
		logger.LogWarning(ex, "StartSession failed due to invalid token format");
		return BadRequest("Invalid token format");
	}
	catch (Exception ex) {
		logger.LogError(ex, "Error processing StartSession request");
		return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while processing the request");
	}
}
```

---

## 7. Protect Endpoints

**Prompt:**  
Demonstrate how to protect a controller endpoint using the custom Passport authentication scheme.

```
[Authorize(AuthenticationSchemes = "Passport")]
public IActionResult SecureEndpoint() {
    // Only accessible with valid passport
}
```

---

**Summary:**  
Use these Copilot prompts and code examples to scaffold Passport Authentication in your .NET project, following the Catalix pattern. Adjust model properties and validation logic as needed for your specific requirements.
