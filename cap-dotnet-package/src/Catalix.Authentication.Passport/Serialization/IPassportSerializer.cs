using Catalix.Authentication.Passport.Models;

namespace Catalix.Authentication.Passport.Serialization;

/// <summary>
/// Non-generic contract for passport deserialization.
/// Used internally by the handler when the concrete passport type is not known at compile time.
/// </summary>
public interface IPassportSerializer
{
    /// <summary>Deserializes a passport string into an <see cref="AuthenticationPassport"/> instance.</summary>
    AuthenticationPassport Deserialize(string passportText);
}

/// <summary>
/// Typed contract for serializing and deserializing a specific passport subtype.
/// Implement this interface to support custom passport models.
/// </summary>
/// <typeparam name="TPassport">The concrete passport type.</typeparam>
public interface IPassportSerializer<TPassport> : IPassportSerializer
    where TPassport : AuthenticationPassport
{
    /// <summary>Deserializes a passport string into a <typeparamref name="TPassport"/> instance.</summary>
    new TPassport Deserialize(string passportText);

    /// <summary>Serializes a <typeparamref name="TPassport"/> instance into a passport string.</summary>
    string Serialize(TPassport passport);
}
