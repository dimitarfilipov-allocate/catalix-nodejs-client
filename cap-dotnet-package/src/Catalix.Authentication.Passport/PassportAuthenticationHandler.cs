using System.Security.Claims;
using System.Text.Encodings.Web;
using Catalix.Authentication.Passport.Context;
using Catalix.Authentication.Passport.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Catalix.Authentication.Passport;

/// <summary>
/// ASP.NET Core authentication handler for Catalix Common Authentication Passport (CAP).
/// Reads the <c>x-passport</c> header (configurable), deserializes it using the configured
/// <see cref="PassportAuthenticationOptions{TPassport}.Serializer"/>, and builds a
/// <see cref="ClaimsPrincipal"/> from the passport's claims.
/// </summary>
/// <typeparam name="TPassport">The passport model type.</typeparam>
public class PassportAuthenticationHandler<TPassport>
    : AuthenticationHandler<PassportAuthenticationOptions<TPassport>>
    where TPassport : AuthenticationPassport
{
    /// <inheritdoc />
    public PassportAuthenticationHandler(
        IOptionsMonitor<PassportAuthenticationOptions<TPassport>> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder) { }

    /// <summary>Typed access to the passport authentication events.</summary>
    protected new PassportAuthenticationEvents<TPassport> Events => Options.Events;

    /// <inheritdoc />
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // ── 1. MessageReceived ──────────────────────────────────────────────────
        var messageReceivedContext = new MessageReceivedContext<TPassport>(Context, Scheme, Options);

        // Allow event handler to inject a token directly
        await Events.MessageReceived(messageReceivedContext);

        if (messageReceivedContext.Result is not null)
            return messageReceivedContext.Result;

        var token = messageReceivedContext.Token
                    ?? Request.Headers[Options.HeaderName].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(token))
        {
            Logger.LogDebug("Passport authentication failed: {Header} header is missing.", Options.HeaderName);
            return AuthenticateResult.NoResult();
        }

        // ── 2. Deserialize ──────────────────────────────────────────────────────
        TPassport passport;
        try
        {
            passport = Options.Serializer.Deserialize(token);
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "Passport deserialization failed.");
            var failedContext = new PassportAuthenticationFailedContext<TPassport>(Context, Scheme, Options, ex);
            await Events.AuthenticationFailed(failedContext);
            return failedContext.Result ?? AuthenticateResult.Fail(ex);
        }

        // ── 3. Build ClaimsPrincipal ────────────────────────────────────────────
        var identity  = new PassportIdentity<TPassport>(passport, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);

        // ── 4. PassportValidated ────────────────────────────────────────────────
        var validatedContext = new PassportValidatedContext<TPassport>(Context, Scheme, Options, passport);
        validatedContext.Principal  = principal;
        validatedContext.Properties = new AuthenticationProperties();

        await Events.PassportValidated(validatedContext);

        if (validatedContext.Result is not null)
            return validatedContext.Result;

        validatedContext.Success();
        return validatedContext.Result!;
    }
}
