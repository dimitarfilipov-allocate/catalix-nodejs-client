namespace CAPNetClient.Middleware;

public class DynamicPathBaseMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<DynamicPathBaseMiddleware> _logger;

    public DynamicPathBaseMiddleware(RequestDelegate next, ILogger<DynamicPathBaseMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue("X-relative-gateway-path", out var pathBaseValue))
        {
            var pathBase = pathBaseValue.ToString().Trim();

            if (!string.IsNullOrEmpty(pathBase))
            {
                if (!pathBase.StartsWith('/'))
                    pathBase = "/" + pathBase;

                if (pathBase.EndsWith('/') && pathBase.Length > 1)
                    pathBase = pathBase.TrimEnd('/');

                _logger.LogDebug("Setting PathBase from X-relative-gateway-path header: {PathBase}", pathBase);

                context.Request.PathBase = pathBase;

                // Strip the path base prefix from Path so routing resolves correctly
                if (context.Request.Path.StartsWithSegments(pathBase, out var remainingPath))
                    context.Request.Path = remainingPath;
            }
        }

        await _next(context);
    }
}

public static class DynamicPathBaseMiddlewareExtensions
{
    public static IApplicationBuilder UseDynamicPathBase(this IApplicationBuilder builder)
        => builder.UseMiddleware<DynamicPathBaseMiddleware>();
}
