using RLD.CommonAuthentication.Passport.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;

namespace RLD.CommonAuthentication.Passport.Context;

/// <summary>
/// Context passed to <see cref="PassportAuthenticationEvents{TPassport}.OnPassportValidated"/>.
/// Use to enrich or replace the <see cref="ResultContext{TOptions}.Principal"/> after successful deserialization.
/// </summary>
public class PassportValidatedContext<TPassport> : ResultContext<PassportAuthenticationOptions<TPassport>>
    where TPassport : AuthenticationPassport {
    /// <inheritdoc />
    public PassportValidatedContext(
        HttpContext context,
        AuthenticationScheme scheme,
        PassportAuthenticationOptions<TPassport> options,
        TPassport passport)
        : base(context, scheme, options) {
        Passport = passport;
    }

    /// <summary>The deserialized, validated passport.</summary>
    public TPassport Passport { get; }
}
