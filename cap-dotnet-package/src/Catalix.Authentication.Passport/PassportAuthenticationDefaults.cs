namespace Catalix.Authentication.Passport;

/// <summary>Default constant values for Catalix Passport authentication.</summary>
public static class PassportAuthenticationDefaults
{
    /// <summary>The default authentication scheme name.</summary>
    public const string AuthenticationScheme = "Passport";

    /// <summary>The display name shown in ASP.NET Core authentication UI.</summary>
    public const string DisplayName = "Common Authentication Passport";

    /// <summary>The HTTP request header that carries the serialized passport string.</summary>
    public const string PassportHeaderName = "x-passport";
}
