using Catalix.Authentication.Passport.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;

namespace Catalix.Authentication.Passport.Context;

/// <summary>
/// Context passed to <see cref="PassportAuthenticationEvents{TPassport}.OnAuthenticationFailed"/>.
/// Inspect <see cref="Exception"/> to determine the failure reason, or call
/// <see cref="ResultContext{TOptions}.Success"/> to override the result.
/// </summary>
public class PassportAuthenticationFailedContext<TPassport> : ResultContext<PassportAuthenticationOptions<TPassport>>
    where TPassport : AuthenticationPassport
{
    /// <inheritdoc />
    public PassportAuthenticationFailedContext(
        HttpContext context,
        AuthenticationScheme scheme,
        PassportAuthenticationOptions<TPassport> options,
        Exception exception)
        : base(context, scheme, options)
    {
        Exception = exception;
    }

    /// <summary>The exception that caused authentication to fail.</summary>
    public Exception Exception { get; }
}
