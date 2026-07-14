using System.Text;
using System.Text.Json;
using Catalix.Authentication.Passport.Models;
using Catalix.Authentication.Passport.Serialization;

namespace Catalix.Authentication.Passport.Generation;

/// <summary>
/// Generates a Catalix Passport from a JWT ID token.
/// <para>
/// The token payload is decoded without signature verification — the caller is responsible
/// for ensuring the token has already been validated by a trusted upstream source
/// (e.g. an OIDC middleware or the Catalix gateway) before calling this generator.
/// </para>
/// </summary>
/// <typeparam name="TPassport">The passport model type to produce.</typeparam>
public class PassportGenerator<TPassport> : IPassportGenerator<TPassport>
    where TPassport : AuthenticationPassport, new()
{
    private readonly IPassportSerializer<TPassport> _serializer;
    private readonly PassportGeneratorOptions<TPassport> _options;

    /// <summary>
    /// Initialises the generator with a serializer and default options.
    /// </summary>
    public PassportGenerator(IPassportSerializer<TPassport> serializer)
        : this(serializer, new PassportGeneratorOptions<TPassport>()) { }

    /// <summary>
    /// Initialises the generator with a serializer and custom options.
    /// </summary>
    public PassportGenerator(IPassportSerializer<TPassport> serializer, PassportGeneratorOptions<TPassport> options)
    {
        _serializer = serializer ?? throw new ArgumentNullException(nameof(serializer));
        _options    = options    ?? throw new ArgumentNullException(nameof(options));
    }

    /// <inheritdoc />
    public TPassport ParseIdToken(string idToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idToken);

        var parts = idToken.Trim().Split('.');
        if (parts.Length != 3)
            throw new ArgumentException("Invalid JWT format — expected header.payload.signature.", nameof(idToken));

        JsonElement root;
        try
        {
            // JWT uses Base64Url encoding (no padding, - instead of +, _ instead of /)
            var payloadBytes = Base64UrlDecode(parts[1]);
            using var doc    = JsonDocument.Parse(payloadBytes);
            root             = doc.RootElement.Clone(); // clone so we can use after doc is disposed
        }
        catch (Exception ex) when (ex is FormatException or JsonException)
        {
            throw new ArgumentException("Failed to decode JWT payload.", nameof(idToken), ex);
        }

        var m        = _options.ClaimMappings;
        var passport = new TPassport
        {
            UserID        = m.TryGetValue(nameof(AuthenticationPassport.UserID),        out var uid)  ? StringValue(root, uid)   ?? string.Empty : string.Empty,
            Email         = m.TryGetValue(nameof(AuthenticationPassport.Email),         out var em)   ? StringValue(root, em)    ?? string.Empty : string.Empty,
            UserType      = m.TryGetValue(nameof(AuthenticationPassport.UserType),      out var ut)   ? StringValue(root, ut)    ?? string.Empty : string.Empty,
            IsSupportUser = m.TryGetValue(nameof(AuthenticationPassport.IsSupportUser), out var sup)  && BoolValue(root, sup),
            UserGroups    = m.TryGetValue(nameof(AuthenticationPassport.UserGroups),    out var grp)  ? StringArrayValue(root, grp) : [],
            OptionalClaims = CollectOptionalClaims(root, _options.OptionalClaimNames)
        };

        // Allow caller to override / extend any field
        _options.ClaimsMapper?.Invoke(passport, root);

        return passport;
    }

    /// <inheritdoc />
    public string GeneratePassportString(TPassport passport)
    {
        ArgumentNullException.ThrowIfNull(passport);
        return _serializer.Serialize(passport);
    }

    /// <inheritdoc />
    public string CreatePassportFromIdToken(string idToken)
        => GeneratePassportString(ParseIdToken(idToken));

    // ── Static factory methods ────────────────────────────────────────────────

    /// <summary>
    /// Creates a generator pre-configured with a <see cref="JsonPassportSerializer{TPassport}"/>.
    /// Use for Node.js client compatibility or testing.
    /// </summary>
    public static PassportGenerator<TPassport> WithJsonSerializer(
        PassportGeneratorOptions<TPassport>? options = null)
        => new(new JsonPassportSerializer<TPassport>(), options ?? new());

    /// <summary>
    /// Creates a generator pre-configured with a <see cref="ProtobufPassportSerializer{TPassport}"/>.
    /// Use for .NET-to-.NET scenarios.
    /// </summary>
    public static PassportGenerator<TPassport> WithProtobufSerializer(
        PassportGeneratorOptions<TPassport>? options = null)
        => new(new ProtobufPassportSerializer<TPassport>(), options ?? new());

    // ── JWT helpers ───────────────────────────────────────────────────────────

    private static byte[] Base64UrlDecode(string base64Url)
    {
        // Restore standard Base64 padding and character substitutions
        var s = base64Url.Replace('-', '+').Replace('_', '/');
        s += (s.Length % 4) switch { 2 => "==", 3 => "=", _ => "" };
        return Convert.FromBase64String(s);
    }

    private static string? StringValue(JsonElement root, string name)
    {
        if (root.TryGetProperty(name, out var el) &&
            el.ValueKind == JsonValueKind.String)
            return el.GetString();
        return null;
    }

    private static bool BoolValue(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var el)) return false;
        return el.ValueKind switch
        {
            JsonValueKind.True  => true,
            JsonValueKind.False => false,
            JsonValueKind.String => bool.TryParse(el.GetString(), out var b) && b,
            _ => false
        };
    }

    private static List<string> StringArrayValue(JsonElement root, string name)
    {
        var result = new List<string>();
        if (!root.TryGetProperty(name, out var el) || el.ValueKind != JsonValueKind.Array)
            return result;
        foreach (var item in el.EnumerateArray())
            if (item.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(item.GetString()))
                result.Add(item.GetString()!);
        return result;
    }

    private static Dictionary<string, string> CollectOptionalClaims(
        JsonElement root, IReadOnlyList<string> names)
    {
        var claims = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var name in names)
        {
            if (!root.TryGetProperty(name, out var el)) continue;
            var value = el.ValueKind == JsonValueKind.String
                ? el.GetString()
                : el.GetRawText();
            if (!string.IsNullOrWhiteSpace(value))
                claims[name] = value!;
        }
        return claims;
    }
}

/// <summary>
/// Non-generic convenience implementation using the base <see cref="AuthenticationPassport"/> type.
/// </summary>
public sealed class PassportGenerator : PassportGenerator<AuthenticationPassport>
{
    /// <inheritdoc />
    public PassportGenerator(IPassportSerializer<AuthenticationPassport> serializer)
        : base(serializer) { }

    /// <inheritdoc />
    public PassportGenerator(IPassportSerializer<AuthenticationPassport> serializer,
                             PassportGeneratorOptions<AuthenticationPassport> options)
        : base(serializer, options) { }
}
