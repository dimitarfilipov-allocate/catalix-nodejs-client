using RLD.CommonAuthentication.Passport.Models;
using RLD.CommonAuthentication.Passport.Serialization;
using FluentAssertions;
using ProtoBuf;
using ProtoBuf.Meta;
using System.Security.Claims;
using Xunit;

namespace RLD.CommonAuthentication.Passport.Tests;

[ProtoContract]
public class AuthPassport2 : AuthenticationPassport {
    [ProtoMember(7)] public string Name { get; set; } = string.Empty;
}

public class PassportSerializerTests {
    /// <summary>
    /// Register AuthPassport2 as a known subtype of AuthenticationPassport so that
    /// protobuf-net serializes base-class fields (members 1-6) alongside member 7.
    /// </summary>
    static PassportSerializerTests() {
        RuntimeTypeModel.Default[typeof(AuthenticationPassport)]
            .AddSubType(100, typeof(AuthPassport2));
    }
    private static AuthPassport2 SamplePassport() => new() {
        UserID = "user-123",
        IsSupportUser = false,
        UserGroups = ["admin", "users"],
        UserType = "standard",
        OptionalClaims = new() { ["name"] = "Alice" },
        Name = "Alice"
    };

    // ── Protobuf serializer ────────────────────────────────────────────────────

    [Fact]
    public void ProtobufSerializer_RoundTrip_PreservesAllFields() {
        var serializer = new ProtobufPassportSerializer<AuthPassport2>();
        var original = SamplePassport();

        var token = serializer.Serialize(original);
        var roundTrip = serializer.Deserialize(token);

        roundTrip.UserID.Should().Be(original.UserID);
        roundTrip.IsSupportUser.Should().Be(original.IsSupportUser);
        roundTrip.UserGroups.Should().BeEquivalentTo(original.UserGroups);
        roundTrip.UserType.Should().Be(original.UserType);
        roundTrip.OptionalClaims.Should().BeEquivalentTo(original.OptionalClaims);
    }

    [Fact]
    public void ProtobufSerializer_Token_StartsWithV1() {
        var token = new ProtobufPassportSerializer<AuthPassport2>().Serialize(SamplePassport());
        token.Should().StartWith("v1.");
        token.Split('.').Should().HaveCount(3);
    }

    // ── ToClaims ───────────────────────────────────────────────────────────────

    [Fact]
    public void ToClaims_IncludesNameIdentifier() {
        var claims = SamplePassport().ToClaims().ToList();
        claims.Should().Contain(c => c.Type == ClaimTypes.NameIdentifier && c.Value == "user-123");
    }

    [Fact]
    public void ToClaims_IncludesGroupsAsRoles() {
        var claims = SamplePassport().ToClaims().ToList();
        claims.Where(c => c.Type == "user_groups").Select(c => c.Value)
              .Should().Contain(["admin", "users"]);
    }

    [Fact]
    public void ToClaims_IncludesOptionalClaims() {
        var claims = SamplePassport().ToClaims().ToList();
        claims.Should().Contain(c =>
            c.Type == "name" &&
            c.Value == "Alice");
    }
}
