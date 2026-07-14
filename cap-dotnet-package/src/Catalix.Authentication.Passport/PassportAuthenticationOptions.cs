using Catalix.Authentication.Passport.Models;
using Catalix.Authentication.Passport.Serialization;
using Microsoft.AspNetCore.Authentication;

namespace Catalix.Authentication.Passport;

/// <summary>
/// Configuration options for Catalix Passport authentication.
/// </summary>
/// <typeparam name="TPassport">
/// The passport model type. Use the base <see cref="AuthenticationPassport"/> or a custom subtype.
/// Pair a custom subtype with a matching <see cref="IPassportSerializer{TPassport}"/>.
/// </typeparam>
public class PassportAuthenticationOptions<TPassport> : AuthenticationSchemeOptions
    where TPassport : AuthenticationPassport
{
    /// <summary>
    /// The HTTP header name that carries the passport string.
    /// Defaults to <see cref="PassportAuthenticationDefaults.PassportHeaderName"/> (<c>x-passport</c>).
    /// </summary>
    public string HeaderName { get; set; } = PassportAuthenticationDefaults.PassportHeaderName;

    /// <summary>
    /// The serializer used to deserialize the incoming passport string.
    /// Defaults to <see cref="ProtobufPassportSerializer{TPassport}"/>.
    /// Swap for <see cref="JsonPassportSerializer{TPassport}"/> when targeting the Node.js client.
    /// </summary>
    public IPassportSerializer<TPassport> Serializer { get; set; } = new ProtobufPassportSerializer<TPassport>();

    /// <summary>Event callbacks invoked at each stage of the authentication flow.</summary>
    public new PassportAuthenticationEvents<TPassport> Events
    {
        get => (PassportAuthenticationEvents<TPassport>)base.Events!;
        set => base.Events = value;
    }

    /// <summary>Initialises default event handlers.</summary>
    public PassportAuthenticationOptions() =>
        Events = new PassportAuthenticationEvents<TPassport>();
}
