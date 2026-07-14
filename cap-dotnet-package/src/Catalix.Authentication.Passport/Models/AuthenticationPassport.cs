using System.Security.Claims;
using ProtoBuf;

namespace Catalix.Authentication.Passport.Models;

/// <summary>
/// Core Catalix Authentication Passport model.
/// <para>
/// Subclass this type to add domain-specific fields, then register your subtype
/// with a custom <see cref="Serialization.IPassportSerializer{TPassport}"/> via
/// <see cref="PassportAuthenticationOptions{TPassport}.Serializer"/>.
/// </para>
/// </summary>
[ProtoContract]
public class AuthenticationPassport
{
    /// <summary>Unique, stable identifier for the user.</summary>
    [ProtoMember(1)] public string UserID { get; set; } = string.Empty;

    /// <summary>User's primary email address.</summary>
    [ProtoMember(2)] public string Email { get; set; } = string.Empty;

    /// <summary>Whether this user holds support-level privileges.</summary>
    [ProtoMember(3)] public bool IsSupportUser { get; set; }

    /// <summary>Group memberships used for role-based authorization.</summary>
    [ProtoMember(4)] public List<string> UserGroups { get; set; } = new();

    /// <summary>
    /// Extensible key/value bag for additional claims not modelled as first-class properties.
    /// Use this to carry extra data without subclassing.
    /// </summary>
    [ProtoMember(5)] public Dictionary<string, string> OptionalClaims { get; set; } = new();

    /// <summary>Account classification (e.g. "standard", "service", "demo").</summary>
    [ProtoMember(6)] public string UserType { get; set; } = string.Empty;

    /// <summary>
    /// Returns <see langword="true"/> when the passport contains the minimum required fields.
    /// Override to enforce domain-specific business rules.
    /// </summary>
    public virtual bool IsValid() =>
        !string.IsNullOrWhiteSpace(UserID) && !string.IsNullOrWhiteSpace(Email);

    /// <summary>
    /// Converts passport properties to <see cref="Claim"/> objects that will be
    /// placed on the resulting <see cref="ClaimsPrincipal"/>.
    /// Override to customise the mapping or add subtype-specific claims.
    /// </summary>
    public virtual IEnumerable<Claim> ToClaims()
    {
        yield return new Claim(ClaimTypes.NameIdentifier, UserID);
        yield return new Claim(ClaimTypes.Email, Email);

        if (!string.IsNullOrWhiteSpace(UserType))
            yield return new Claim(PassportClaimTypes.UserType, UserType);

        if (IsSupportUser)
            yield return new Claim(PassportClaimTypes.IsSupportUser, bool.TrueString);

        foreach (var group in UserGroups)
        {
            yield return new Claim(ClaimTypes.Role, group);
            yield return new Claim(PassportClaimTypes.UserGroup, group);
        }

        foreach (var (key, value) in OptionalClaims)
            yield return new Claim($"{PassportClaimTypes.OptionalClaimPrefix}{key}", value);
    }
}
