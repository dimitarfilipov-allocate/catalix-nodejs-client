using Catalix.Authentication.Passport.Models;

namespace Catalix.Authentication.Passport.Generation;

/// <summary>Non-generic contract for passport generation.</summary>
public interface IPassportGenerator
{
    /// <summary>
    /// Parses a JWT ID token, maps its claims to an <see cref="AuthenticationPassport"/>,
    /// and returns the serialized passport string.
    /// </summary>
    /// <param name="idToken">A JWT in the format <c>header.payload.signature</c>.</param>
    /// <returns>A passport string in the format <c>v1.&lt;payload&gt;.&lt;signature&gt;</c>.</returns>
    string CreatePassportFromIdToken(string idToken);
}

/// <summary>Typed contract for generating a specific passport subtype from a JWT ID token.</summary>
/// <typeparam name="TPassport">The passport model type.</typeparam>
public interface IPassportGenerator<TPassport> : IPassportGenerator
    where TPassport : AuthenticationPassport
{
    /// <summary>
    /// Parses a JWT ID token and maps its claims to a <typeparamref name="TPassport"/> instance.
    /// </summary>
    new TPassport ParseIdToken(string idToken);

    /// <summary>Serializes an existing <typeparamref name="TPassport"/> to a passport string.</summary>
    string GeneratePassportString(TPassport passport);
}
