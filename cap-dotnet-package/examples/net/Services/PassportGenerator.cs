using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using RLD.CommonAuthentication.Passport.Models;
using RLD.CommonAuthentication.Passport.Serialization;
using CAPNetClient.Models;

namespace CAPNetClient.Services;

public interface IPassportGenerator
{
    string CreatePassportFromIdToken(string idToken);
}

public class PassportGenerator : IPassportGenerator
{
    private readonly ILogger<PassportGenerator> _logger;
    private readonly IPassportSerializer<AppPassport> _passportSerializer;

    public PassportGenerator(ILogger<PassportGenerator> logger, IPassportSerializer<AppPassport> passportSerializer)
    {
        _logger = logger;
        _passportSerializer = passportSerializer;
    }

    public string CreatePassportFromIdToken(string idToken)
    {
        if (string.IsNullOrWhiteSpace(idToken))
            throw new ArgumentException("ID token cannot be null or empty", nameof(idToken));

        try
        {
            var handler = new JwtSecurityTokenHandler();
            var jwtToken = handler.ReadJwtToken(idToken);

            var userId = jwtToken.Claims.FirstOrDefault(c => c.Type == "sub")?.Value
                ?? jwtToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value
                ?? string.Empty;

            var email = jwtToken.Claims.FirstOrDefault(c => c.Type == "email")?.Value
                ?? jwtToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Email)?.Value
                ?? string.Empty;

            var userGroups = jwtToken.Claims
                .Where(c => c.Type == "groups" || c.Type == ClaimTypes.Role)
                .Select(c => c.Value)
                .ToList();

            var passport = new AppPassport
            {
                UserID = userId,
                Email = email,
                IsSupportUser = false,
                UserGroups = userGroups,
                UserType = "Standard",
                OptionalClaims = jwtToken.Claims
                    .Where(c => c.Type != "sub" && c.Type != "email" && c.Type != "groups")
                    .ToDictionary(c => c.Type, c => c.Value)
            };

            _logger.LogInformation("Created passport for user: {UserId}", userId);
            return _passportSerializer.Serialize(passport);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create passport from ID token");
            throw new InvalidOperationException("Failed to process ID token", ex);
        }
    }
}
