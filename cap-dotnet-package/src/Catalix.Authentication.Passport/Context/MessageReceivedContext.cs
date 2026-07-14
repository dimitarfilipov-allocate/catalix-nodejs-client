using Catalix.Authentication.Passport.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;

namespace Catalix.Authentication.Passport.Context;

/// <summary>
/// Context passed to <see cref="PassportAuthenticationEvents{TPassport}.OnMessageReceived"/>.
/// Set <see cref="Token"/> to override the raw passport string before deserialization.
/// </summary>
public class MessageReceivedContext<TPassport> : ResultContext<PassportAuthenticationOptions<TPassport>>
    where TPassport : AuthenticationPassport
{
    /// <inheritdoc />
    public MessageReceivedContext(
        HttpContext context,
        AuthenticationScheme scheme,
        PassportAuthenticationOptions<TPassport> options)
        : base(context, scheme, options) { }

    /// <summary>
    /// The raw passport string read from the configured header.
    /// Assign a value here to bypass header reading and use this token directly.
    /// </summary>
    public string? Token { get; set; }
}
