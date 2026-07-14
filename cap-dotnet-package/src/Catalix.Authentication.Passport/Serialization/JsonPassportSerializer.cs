using System.Text;
using System.Text.Json;
using Catalix.Authentication.Passport.Models;

namespace Catalix.Authentication.Passport.Serialization;

/// <summary>
/// Passport serializer using JSON encoding (System.Text.Json).
/// Produces passports compatible with the Node.js Catalix client implementation.
/// Format: <c>v1.&lt;Base64(UTF8 JSON)&gt;.&lt;Base64("static.passport.test")&gt;</c>
/// </summary>
public class JsonPassportSerializer<TPassport> : IPassportSerializer<TPassport>
    where TPassport : AuthenticationPassport, new()
{
    private static readonly string StaticSignature =
        Convert.ToBase64String(Encoding.ASCII.GetBytes("static.passport.test"));

    private static readonly JsonSerializerOptions DefaultOptions = new()
    {
        PropertyNamingPolicy        = null,   // preserve PascalCase to match the C# model
        PropertyNameCaseInsensitive = true,
        WriteIndented               = false
    };

    private readonly JsonSerializerOptions _options;

    /// <summary>Creates an instance using the default JSON serializer options.</summary>
    public JsonPassportSerializer() : this(DefaultOptions) { }

    /// <summary>Creates an instance with custom JSON serializer options.</summary>
    public JsonPassportSerializer(JsonSerializerOptions options) => _options = options;

    /// <inheritdoc />
    public TPassport Deserialize(string passportText)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(passportText);

        var parts = passportText.Trim().Split('.');
        if (parts.Length != 3 || parts[0] != "v1")
            throw new InvalidOperationException("Invalid passport format — expected v1.<payload>.<signature>.");

        byte[] payloadBytes;
        try
        {
            payloadBytes = Convert.FromBase64String(parts[1]);
        }
        catch (FormatException ex)
        {
            throw new InvalidOperationException("Passport payload is not valid Base64.", ex);
        }

        var json     = Encoding.UTF8.GetString(payloadBytes);
        var passport = JsonSerializer.Deserialize<TPassport>(json, _options)
                       ?? throw new InvalidOperationException("JSON deserialization returned null.");

        if (!passport.IsValid())
            throw new InvalidOperationException("Passport payload is invalid or missing required fields.");

        return passport;
    }

    /// <inheritdoc />
    AuthenticationPassport IPassportSerializer.Deserialize(string passportText) => Deserialize(passportText);

    /// <inheritdoc />
    public string Serialize(TPassport passport)
    {
        ArgumentNullException.ThrowIfNull(passport);

        var json    = JsonSerializer.Serialize(passport, _options);
        var payload = Convert.ToBase64String(Encoding.UTF8.GetBytes(json));
        return $"v1.{payload}.{StaticSignature}";
    }
}

/// <summary>
/// Non-generic convenience implementation using the base <see cref="AuthenticationPassport"/> type.
/// </summary>
public sealed class JsonPassportSerializer : JsonPassportSerializer<AuthenticationPassport> { }
