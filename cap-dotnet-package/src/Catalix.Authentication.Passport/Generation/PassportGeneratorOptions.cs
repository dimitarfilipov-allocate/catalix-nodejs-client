using System.Text.Json;
using Catalix.Authentication.Passport.Models;

namespace Catalix.Authentication.Passport.Generation;

/// <summary>
/// Options for <see cref="PassportGenerator{TPassport}"/>.
/// </summary>
/// <typeparam name="TPassport">The passport model type.</typeparam>
public class PassportGeneratorOptions<TPassport>
    where TPassport : AuthenticationPassport, new()
{
    /// <summary>
    /// Maps <see cref="AuthenticationPassport"/> property names to the corresponding
    /// JWT ID token claim names.
    /// <para>
    /// Key   = property name on the passport model (e.g. <c>nameof(AuthenticationPassport.UserID)</c>).<br/>
    /// Value = claim name in the JWT payload (e.g. <c>"sub"</c>).
    /// </para>
    /// Override individual entries to adapt to a non-standard identity provider.
    /// </summary>
    public Dictionary<string, string> ClaimMappings { get; set; } = new()
    {
        [nameof(AuthenticationPassport.UserID)]        = "sub",
        [nameof(AuthenticationPassport.Email)]         = "email",
        [nameof(AuthenticationPassport.UserType)]      = "user_type",
        [nameof(AuthenticationPassport.IsSupportUser)] = "is_support",
        [nameof(AuthenticationPassport.UserGroups)]    = "groups",
    };

    /// <summary>
    /// JWT claim names copied verbatim into <see cref="AuthenticationPassport.OptionalClaims"/>.
    /// Defaults to <c>["name", "preferred_username", "given_name", "family_name"]</c>.
    /// </summary>
    public IReadOnlyList<string> OptionalClaimNames { get; set; } =
        ["name", "preferred_username", "given_name", "family_name"];

    /// <summary>
    /// Custom delegate invoked <em>after</em> the default claim mapping.
    /// Use this to map additional JWT claims onto custom passport properties,
    /// or to override values set by <see cref="ClaimMappings"/>.
    /// <para>The <see cref="JsonElement"/> is the root of the decoded JWT payload.</para>
    /// </summary>
    public Action<TPassport, JsonElement>? ClaimsMapper { get; set; }
}
