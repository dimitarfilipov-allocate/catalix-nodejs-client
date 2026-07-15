using System.Net;
using System.Security.Claims;
using RLD.CommonAuthentication.Passport.Models;
using RLD.CommonAuthentication.Passport.Serialization;
using FluentAssertions;
using Xunit;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace RLD.CommonAuthentication.Passport.Tests;

public class PassportAuthenticationHandlerTests {
    private static string GenerateToken(AuthenticationPassport? passport = null) {
        passport ??= new AuthenticationPassport {
            UserID = "test-user",
            UserType = "standard",
            UserGroups = ["users"]
        };
        return new ProtobufPassportSerializer().Serialize(passport);
    }

    private static IHost BuildHost(Action<PassportAuthenticationOptions<AuthenticationPassport>>? configure = null) {
        return new HostBuilder()
            .ConfigureWebHost(web => {
                web.UseTestServer();
                web.ConfigureServices(services => {
                    services.AddRouting();
                    services.AddAuthentication(PassportAuthenticationDefaults.AuthenticationScheme)
                            .AddPassport(opts => {
                                opts.Serializer = new ProtobufPassportSerializer();
                                configure?.Invoke(opts);
                            });
                });
                web.Configure(app => {
                    app.UseRouting();
                    app.UseAuthentication();
                    app.Run(async ctx => {
                        if (!ctx.User.Identity?.IsAuthenticated ?? true) {
                            ctx.Response.StatusCode = 401;
                            return;
                        }
                        var userId = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier);
                        await ctx.Response.WriteAsync(userId ?? "no-id");
                    });
                });
            })
            .Build();
    }

    [Fact]
    public async Task ValidPassport_Returns200_WithUserId() {
        using var host = BuildHost();
        await host.StartAsync();
        var client = host.GetTestClient();

        client.DefaultRequestHeaders.Add("x-passport", GenerateToken());
        var response = await client.GetAsync("/");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Be("test-user");
    }

    [Fact]
    public async Task MissingHeader_Returns401() {
        using var host = BuildHost();
        await host.StartAsync();
        var client = host.GetTestClient();

        var response = await client.GetAsync("/");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task InvalidToken_Returns401() {
        using var host = BuildHost();
        await host.StartAsync();
        var client = host.GetTestClient();

        client.DefaultRequestHeaders.Add("x-passport", "v1.bad.payload");
        var response = await client.GetAsync("/");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task OnMessageReceived_CanInjectToken() {
        var injectedToken = GenerateToken();

        using var host = BuildHost(opts => {
            opts.Events.OnMessageReceived = ctx => {
                ctx.Token = injectedToken;
                return Task.CompletedTask;
            };
        });
        await host.StartAsync();

        // No header — token injected via event
        var response = await host.GetTestClient().GetAsync("/");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task OnPassportValidated_CanAddExtraClaims() {
        using var host = BuildHost(opts => {
            opts.Events.OnPassportValidated = ctx => {
                ctx.Principal!.AddIdentity(new ClaimsIdentity(
                    new[] { new Claim("custom", "extra-value") }));
                return Task.CompletedTask;
            };
        });
        await host.StartAsync();
        var client = host.GetTestClient();
        client.DefaultRequestHeaders.Add("x-passport", GenerateToken());

        var response = await client.GetAsync("/");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
