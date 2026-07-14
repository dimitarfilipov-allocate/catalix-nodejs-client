using System.Reflection;
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

    /// <summary>Whether this user holds support-level privileges.</summary>
    [ProtoMember(2)] public bool IsSupportUser { get; set; }

    /// <summary>Group memberships used for role-based authorization.</summary>
    [ProtoMember(3)] public List<string> UserGroups { get; set; } = new();

    /// <summary>
    /// Extensible key/value bag for additional claims not modelled as first-class properties.
    /// Use this to carry extra data without subclassing.
    /// </summary>
    [ProtoMember(4)] public Dictionary<string, string> OptionalClaims { get; set; } = new();

    /// <summary>Account classification (e.g. "standard", "service", "demo").</summary>
    [ProtoMember(5)] public string UserType { get; set; } = string.Empty;

    /// <summary>
    /// Returns <see langword="true"/> when the passport contains the minimum required fields.
    /// Override to enforce domain-specific business rules.
    /// </summary>
    public virtual bool IsValid() => !string.IsNullOrWhiteSpace(UserID);

    /// <summary>
    /// Converts the passport (including all fields from derived types) into a flat list of
    /// <see cref="Claim"/> instances suitable for building a <see cref="ClaimsPrincipal"/>.
    /// </summary>
    public IEnumerable<Claim> ToClaims()
    {
        // Base well-known claims
        yield return new Claim(ClaimTypes.NameIdentifier, UserID);
        yield return new Claim("support_user", IsSupportUser.ToString().ToLowerInvariant());
        yield return new Claim("user_type", UserType);

        foreach (var group in UserGroups)
            yield return new Claim("user_groups", group);

        foreach (var (key, value) in OptionalClaims)
            yield return new Claim(key, value);

        // Reflect over the actual (possibly derived) type and emit any additional properties
        // that are not already covered by the base class properties above.
        var baseProperties = typeof(AuthenticationPassport)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Select(p => p.Name)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var prop in GetType()
                     .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                     .Where(p => !baseProperties.Contains(p.Name) && p.CanRead))
        {
            var value = prop.GetValue(this);
            if (value is null) continue;

            if (value is IEnumerable<string> strings)
            {
                foreach (var s in strings)
                    yield return new Claim(prop.Name, s);
            }
            else
            {
                yield return new Claim(prop.Name, value.ToString()!);
            }
        }
    }
}
