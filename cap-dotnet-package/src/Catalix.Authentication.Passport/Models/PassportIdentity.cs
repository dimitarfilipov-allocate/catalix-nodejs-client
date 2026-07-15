using System.Security.Principal;
using System.Security.Claims;

namespace RLD.CommonAuthentication.Passport.Models;

/// <summary>
/// An <see cref="IIdentity"/> that holds the strongly-typed <typeparamref name="TPassport"/>
/// and exposes its full claim set — including any fields added by derived passport types.
/// </summary>
/// <typeparam name="TPassport">The concrete passport type (may be a subclass of <see cref="AuthenticationPassport"/>).</typeparam>
public sealed class PassportIdentity<TPassport> : ClaimsIdentity
    where TPassport : AuthenticationPassport {
    /// <summary>The deserialized passport that backs this identity.</summary>
    public TPassport Passport { get; }

    /// <summary>
    /// Initializes a new <see cref="PassportIdentity{TPassport}"/> from the supplied
    /// <paramref name="passport"/>, emitting claims for every field in the concrete
    /// passport type (base + derived).
    /// </summary>
    /// <param name="passport">The passport to build the identity from.</param>
    /// <param name="authenticationType">
    /// The authentication type string forwarded to <see cref="ClaimsIdentity"/>.
    /// </param>
    public PassportIdentity(TPassport passport, string authenticationType)
        : base(passport.ToClaims(), authenticationType) {
        Passport = passport;
    }
}
