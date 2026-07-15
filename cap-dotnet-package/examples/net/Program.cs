using RLD.CommonAuthentication.Passport;
using RLD.CommonAuthentication.Passport.Models;
using RLD.CommonAuthentication.Passport.Serialization;
using Microsoft.AspNetCore.HttpOverrides;
using ProtoBuf.Meta;
using CAPNetClient.Middleware;
using CAPNetClient.Models;
using CAPNetClient.Services;

var builder = WebApplication.CreateBuilder(args);

// Register the derived passport type with Protobuf runtime model
RuntimeTypeModel.Default[typeof(AuthenticationPassport)]
    .AddSubType(100, typeof(AppPassport));

// Configure forwarded headers for reverse proxy
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor |
                               ForwardedHeaders.XForwardedProto |
                               ForwardedHeaders.XForwardedHost;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Register passport authentication
builder.Services
    .AddAuthentication(PassportAuthenticationDefaults.AuthenticationScheme)
    .AddPassport<AppPassport>(options => { });

// Register application services
builder.Services.AddScoped<IPassportGenerator, PassportGenerator>();
builder.Services.AddScoped<IPassportSerializer<AppPassport>, ProtobufPassportSerializer<AppPassport>>();

builder.Services.AddRazorPages();
builder.Services.AddControllers();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

//app.UseHttpsRedirection();

// Apply forwarded headers before anything else
app.UseForwardedHeaders();

// Resolve dynamic path base from X-relative-gateway-path header
app.UseDynamicPathBase();

app.MapStaticAssets();

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapRazorPages()
   .WithStaticAssets();
app.MapControllers();

app.Run();
