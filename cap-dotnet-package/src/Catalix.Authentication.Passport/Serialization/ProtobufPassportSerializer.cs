using System.Text;
using RLD.CommonAuthentication.Passport.Models;
using ProtoBuf;

namespace RLD.CommonAuthentication.Passport.Serialization;

/// <summary>
/// Passport serializer using Protobuf-net binary encoding.
/// Produces passports compatible with the .NET Catalix CAP implementation.
/// Format: <c>v1.&lt;Base64(ProtobufBytes)&gt;.&lt;Base64("static.passport.test")&gt;</c>
/// </summary>
public class ProtobufPassportSerializer<TPassport> : IPassportSerializer<TPassport>
    where TPassport : AuthenticationPassport {
    private static readonly string StaticSignature =
        Convert.ToBase64String(Encoding.ASCII.GetBytes("static.passport.test"));

    /// <inheritdoc />
    public TPassport Deserialize(string passportText) {
        ArgumentException.ThrowIfNullOrWhiteSpace(passportText);

        var parts = passportText.Trim().Split('.');
        if (parts.Length != 3 || parts[0] != "v1")
            throw new InvalidOperationException("Invalid passport format — expected v1.<payload>.<signature>.");

        if (parts[2] != StaticSignature)
            throw new InvalidOperationException("Passport signature validation failed.");

        byte[] payloadBytes;
        try {
            payloadBytes = Convert.FromBase64String(parts[1]);
        } catch (FormatException ex) {
            throw new InvalidOperationException("Passport payload is not valid Base64.", ex);
        }

        TPassport passport;
        using (var ms = new MemoryStream(payloadBytes)) {
            passport = Serializer.Deserialize<TPassport>(ms);
        }

        if (passport is null || !passport.IsValid())
            throw new InvalidOperationException("Passport payload is invalid or missing required fields.");

        return passport;
    }

    /// <inheritdoc />
    AuthenticationPassport IPassportSerializer.Deserialize(string passportText) => Deserialize(passportText);

    /// <inheritdoc />
    public string Serialize(TPassport passport) {
        ArgumentNullException.ThrowIfNull(passport);

        using var stream = new MemoryStream();
        Serializer.Serialize(stream, passport);
        var payload = Convert.ToBase64String(stream.ToArray());
        return $"v1.{payload}.{StaticSignature}";
    }
}

/// <summary>
/// Non-generic convenience implementation using the base <see cref="AuthenticationPassport"/> type.
/// </summary>
public sealed class ProtobufPassportSerializer : ProtobufPassportSerializer<AuthenticationPassport> { }
