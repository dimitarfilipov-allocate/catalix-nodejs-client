using Catalix.Authentication.Passport.Models;
using Microsoft.AspNetCore.Authentication;

namespace Catalix.Authentication.Passport;

/// <summary>
/// Extension methods for registering Catalix Passport authentication with ASP.NET Core.
/// </summary>
public static class PassportAuthenticationExtensions
{
    // ── Base type overloads ────────────────────────────────────────────────────

    /// <summary>
    /// Adds Catalix Passport authentication using the base <see cref="AuthenticationPassport"/> model
    /// and the default scheme name (<see cref="PassportAuthenticationDefaults.AuthenticationScheme"/>).
    /// </summary>
    public static AuthenticationBuilder AddPassport(this AuthenticationBuilder builder)
        => builder.AddPassport(PassportAuthenticationDefaults.AuthenticationScheme, _ => { });

    /// <summary>
    /// Adds Catalix Passport authentication using the base <see cref="AuthenticationPassport"/> model.
    /// </summary>
    public static AuthenticationBuilder AddPassport(
        this AuthenticationBuilder builder,
        Action<PassportAuthenticationOptions<AuthenticationPassport>> configureOptions)
        => builder.AddPassport(PassportAuthenticationDefaults.AuthenticationScheme, configureOptions);

    /// <summary>
    /// Adds Catalix Passport authentication using the base <see cref="AuthenticationPassport"/> model
    /// under a custom scheme name.
    /// </summary>
    public static AuthenticationBuilder AddPassport(
        this AuthenticationBuilder builder,
        string authenticationScheme,
        Action<PassportAuthenticationOptions<AuthenticationPassport>> configureOptions)
        => builder.AddPassport<AuthenticationPassport>(authenticationScheme, configureOptions);

    // ── Generic overloads ──────────────────────────────────────────────────────

    /// <summary>
    /// Adds Catalix Passport authentication with a custom passport model.
    /// Supply a matching <see cref="Serialization.IPassportSerializer{TPassport}"/> via
    /// <see cref="PassportAuthenticationOptions{TPassport}.Serializer"/>.
    /// </summary>
    /// <typeparam name="TPassport">Custom passport subtype.</typeparam>
    public static AuthenticationBuilder AddPassport<TPassport>(
        this AuthenticationBuilder builder,
        Action<PassportAuthenticationOptions<TPassport>> configureOptions)
        where TPassport : AuthenticationPassport
        => builder.AddPassport<TPassport>(PassportAuthenticationDefaults.AuthenticationScheme, configureOptions);

    /// <summary>
    /// Adds Catalix Passport authentication with a custom passport model under a custom scheme name.
    /// </summary>
    /// <typeparam name="TPassport">Custom passport subtype.</typeparam>
    public static AuthenticationBuilder AddPassport<TPassport>(
        this AuthenticationBuilder builder,
        string authenticationScheme,
        Action<PassportAuthenticationOptions<TPassport>> configureOptions)
        where TPassport : AuthenticationPassport
        => builder.AddScheme<
            PassportAuthenticationOptions<TPassport>,
            PassportAuthenticationHandler<TPassport>>(
                authenticationScheme,
                PassportAuthenticationDefaults.DisplayName,
                configureOptions);
}
