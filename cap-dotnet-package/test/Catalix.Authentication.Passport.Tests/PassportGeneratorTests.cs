using System.Text;
using System.Text.Json;
using Catalix.Authentication.Passport.Generation;
using Catalix.Authentication.Passport.Models;
using Catalix.Authentication.Passport.Serialization;
using FluentAssertions;
using Xunit;

namespace Catalix.Authentication.Passport.Tests;

public class PassportGeneratorTests
{
    // ── JWT factory helpers ────────────────────────────────────────────────────

    /// <summary>Builds a minimal unsigned JWT with the given payload claims.</summary>
    private static string BuildJwt(object payload)
    {
        var header  = Base64UrlEncode("""{"alg":"none","typ":"JWT"}""");
        var body    = Base64UrlEncode(JsonSerializer.Serialize(payload));
        return $"{header}.{body}.";
    }

    private static string Base64UrlEncode(string json)
        => Convert.ToBase64String(Encoding.UTF8.GetBytes(json))
                  .TrimEnd('=')
                  .Replace('+', '-')
                  .Replace('/', '_');

    private static PassportGenerator<AuthenticationPassport> CreateGenerator()
        => PassportGenerator<AuthenticationPassport>.WithJsonSerializer();

    // ── ParseIdToken ───────────────────────────────────────────────────────────

    [Fact]
    public void ParseIdToken_MapsStandardClaims()
    {
        var jwt = BuildJwt(new
        {
            sub        = "user-123",
            email      = "user@example.com",
            user_type  = "standard",
            is_support = false,
            groups     = new[] { "admin", "users" },
            name       = "Alice"
        });

        var passport = CreateGenerator().ParseIdToken(jwt);

        passport.UserID.Should().Be("user-123");
        passport.Email.Should().Be("user@example.com");
        passport.UserType.Should().Be("standard");
        passport.IsSupportUser.Should().BeFalse();
        passport.UserGroups.Should().BeEquivalentTo(["admin", "users"]);
        passport.OptionalClaims.Should().ContainKey("name").WhoseValue.Should().Be("Alice");
    }

    [Fact]
    public void ParseIdToken_OverriddenClaimMapping_UsesCustomClaimName()
    {
        // Override UserID mapping from default "sub" to "oid"
        var gen = new PassportGenerator<AuthenticationPassport>(
            new JsonPassportSerializer(),
            new PassportGeneratorOptions<AuthenticationPassport>
            {
                ClaimMappings = new()
                {
                    [nameof(AuthenticationPassport.UserID)]        = "oid",
                    [nameof(AuthenticationPassport.Email)]         = "email",
                    [nameof(AuthenticationPassport.UserType)]      = "user_type",
                    [nameof(AuthenticationPassport.IsSupportUser)] = "is_support",
                    [nameof(AuthenticationPassport.UserGroups)]    = "groups",
                }
            });

        var jwt      = BuildJwt(new { oid = "oid-456", email = "a@b.com" });
        var passport = gen.ParseIdToken(jwt);
        passport.UserID.Should().Be("oid-456");
    }

    [Fact]
    public void ParseIdToken_UserGroups_MappedFromConfiguredClaim()
    {
        var jwt = BuildJwt(new
        {
            sub    = "u1",
            email  = "u@x.com",
            groups = new[] { "g1", "g2" }
        });

        var passport = CreateGenerator().ParseIdToken(jwt);
        passport.UserGroups.Should().BeEquivalentTo(["g1", "g2"]);
    }

    [Fact]
    public void ParseIdToken_AppliesCustomClaimsMapper()
    {
        var options = new PassportGeneratorOptions<AuthenticationPassport>
        {
            ClaimsMapper = (p, root) =>
            {
                if (root.TryGetProperty("tenant_id", out var t))
                    p.OptionalClaims["tenant_id"] = t.GetString()!;
            }
        };
        var generator = new PassportGenerator<AuthenticationPassport>(
            new JsonPassportSerializer(), options);

        var jwt      = BuildJwt(new { sub = "u1", email = "a@b.com", tenant_id = "tenant-xyz" });
        var passport = generator.ParseIdToken(jwt);

        passport.OptionalClaims.Should().ContainKey("tenant_id")
            .WhoseValue.Should().Be("tenant-xyz");
    }

    [Fact]
    public void ParseIdToken_ThrowsOnInvalidJwtFormat()
    {
        var act = () => CreateGenerator().ParseIdToken("not.a.valid.jwt.too.many.parts");
        act.Should().Throw<ArgumentException>().WithMessage("*JWT format*");
    }

    // ── CreatePassportFromIdToken ──────────────────────────────────────────────

    [Fact]
    public void CreatePassportFromIdToken_ReturnsV1PassportString()
    {
        var jwt   = BuildJwt(new { sub = "u1", email = "a@b.com", user_type = "standard" });
        var token = CreateGenerator().CreatePassportFromIdToken(jwt);

        token.Should().StartWith("v1.");
        token.Split('.').Should().HaveCount(3);
    }

    [Fact]
    public void CreatePassportFromIdToken_RoundTripDeserializes()
    {
        var jwt      = BuildJwt(new { sub = "u1", email = "a@b.com", user_type = "standard" });
        var generator   = CreateGenerator();
        var token    = generator.CreatePassportFromIdToken(jwt);
        var passport = new JsonPassportSerializer().Deserialize(token);

        passport.UserID.Should().Be("u1");
        passport.Email.Should().Be("a@b.com");
    }

    // ── Static factory methods ─────────────────────────────────────────────────

    [Fact]
    public void WithJsonSerializer_CreatesWorkingGenerator()
    {
        var gen = PassportGenerator<AuthenticationPassport>.WithJsonSerializer();
        var jwt = BuildJwt(new { sub = "u1", email = "a@b.com" });
        gen.Invoking(g => g.CreatePassportFromIdToken(jwt)).Should().NotThrow();
    }

    [Fact]
    public void WithProtobufSerializer_CreatesWorkingGenerator()
    {
        var gen = PassportGenerator<AuthenticationPassport>.WithProtobufSerializer();
        var jwt = BuildJwt(new { sub = "u1", email = "a@b.com" });
        gen.Invoking(g => g.CreatePassportFromIdToken(jwt)).Should().NotThrow();
    }
}
