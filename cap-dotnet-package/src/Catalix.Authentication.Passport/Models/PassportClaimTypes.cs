namespace RLD.CommonAuthentication.Passport.Models;

/// <summary>Well-known claim type URNs emitted when a passport is validated.</summary>
public static class PassportClaimTypes {

    /// <summary>The user's account classification (e.g. "standard", "service", "demo").</summary>
    public const string UserType = "user_type";

    /// <summary>Present and set to "True" when the user has support-level access.</summary>
    public const string IsSupportUser = "support_user";

    /// <summary>Issued once per group membership, in addition to <see cref="System.Security.Claims.ClaimTypes.Role"/>.</summary>
    public const string UserGroup = "user_groups";

    /// <summary>Prefix for claims sourced from <see cref="AuthenticationPassport.OptionalClaims"/>.</summary>
    public const string OptionalClaimPrefix = "additional_claim_";
}
