using Catalix.Authentication.Passport.Context;
using Catalix.Authentication.Passport.Models;

namespace Catalix.Authentication.Passport;

/// <summary>
/// Event callbacks for the Catalix Passport authentication flow.
/// Follows the same pattern as <c>JwtBearerEvents</c> and <c>OpenIdConnectEvents</c>.
/// </summary>
/// <typeparam name="TPassport">The passport model type.</typeparam>
public class PassportAuthenticationEvents<TPassport>
    where TPassport : AuthenticationPassport
{
    /// <summary>
    /// Invoked when the passport header has been read but <em>before</em> deserialization.
    /// Set <see cref="MessageReceivedContext{TPassport}.Token"/> to override the raw value.
    /// </summary>
    public Func<MessageReceivedContext<TPassport>, Task> OnMessageReceived { get; set; }
        = _ => Task.CompletedTask;

    /// <summary>
    /// Invoked after the passport has been deserialized and validated.
    /// Use this hook to enrich the <c>ClaimsPrincipal</c>, add extra claims, or replace the result entirely.
    /// </summary>
    public Func<PassportValidatedContext<TPassport>, Task> OnPassportValidated { get; set; }
        = _ => Task.CompletedTask;

    /// <summary>
    /// Invoked when authentication fails (missing header, invalid format, bad signature, etc.).
    /// Call <see cref="Microsoft.AspNetCore.Authentication.ResultContext{TOptions}.Success"/> on the context to recover.
    /// </summary>
    public Func<PassportAuthenticationFailedContext<TPassport>, Task> OnAuthenticationFailed { get; set; }
        = _ => Task.CompletedTask;

    /// <summary>Raises <see cref="OnMessageReceived"/>.</summary>
    public virtual Task MessageReceived(MessageReceivedContext<TPassport> context)
        => OnMessageReceived(context);

    /// <summary>Raises <see cref="OnPassportValidated"/>.</summary>
    public virtual Task PassportValidated(PassportValidatedContext<TPassport> context)
        => OnPassportValidated(context);

    /// <summary>Raises <see cref="OnAuthenticationFailed"/>.</summary>
    public virtual Task AuthenticationFailed(PassportAuthenticationFailedContext<TPassport> context)
        => OnAuthenticationFailed(context);
}
