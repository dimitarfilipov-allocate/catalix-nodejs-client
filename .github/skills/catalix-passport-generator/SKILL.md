---
name: catalix-passport-generator
description: "Use this skill to generate Passport for testing from Json Web token (JWT) or Json Payload"
license: Proprietary. LICENSE.txt has complete terms
---

## Generate Passport from JWT

Use pdfplumber for text extraction. For scanned documents, fall back to
pdf2image with pytesseract.

```
using ProtoBuf;
using System;
using System.IO;
using System.Text;

using System.Text.Json;

public static class PassportSerializer {

    public static string SerializeFromJson(string json) {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var passport = new AuthenticationPassport {
            UserID        = root.TryGetProperty("UserID",out var uid)  ? uid.GetString()  : string.Empty,
            Email         = root.TryGetProperty("Email",out var em)   ? em.GetString()   : string.Empty,
            IsSupportUser = root.TryGetProperty("IsSupportUser",out var sup)  && sup.GetBoolean(),
            UserType      = root.TryGetProperty("UserType",out var ut)   ? ut.GetString()   : string.Empty,
            UserGroups    = root.TryGetProperty("UserGroups",out var grps)
                                ? grps.EnumerateArray().Select(g => g.GetString()).ToList()
                                : new List<string>(),
            OptionalClaims = root.TryGetProperty("OptionalClaims", out var oc)
                                ? oc.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.ToString())
                                : new Dictionary<string, string>()
        };

        return Serialize(passport);
    }

    public static string Serialize(AuthenticationPassport passport) {
        using var stream = new MemoryStream();
        Serializer.Serialize(stream, passport);
        var payload   = Convert.ToBase64String(stream.ToArray());
        var signature = Convert.ToBase64String(Encoding.ASCII.GetBytes("static.passport.test"));
        return $"v1.{payload}.{signature}";
    }
}
```