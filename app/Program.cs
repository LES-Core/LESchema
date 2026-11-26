using System.Diagnostics;
using System.Net;
using System.Reflection;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.StaticFiles;

const string resourcePrefix = "web/";
var assembly = Assembly.GetExecutingAssembly();
var assets = assembly.GetManifestResourceNames()
    .Where(name => name.StartsWith(resourcePrefix, StringComparison.Ordinal))
    .ToDictionary(name => name[resourcePrefix.Length..].Replace('\\', '/'), StringComparer.Ordinal);
var contentTypes = new FileExtensionContentTypeProvider();

var builder = WebApplication.CreateSlimBuilder();
builder.Logging.SetMinimumLevel(LogLevel.Warning);
builder.WebHost.ConfigureKestrel(options => options.Listen(IPAddress.Loopback, 0));
await using var app = builder.Build();

app.MapMethods("/{**path}", ["GET", "HEAD"], (string? path, HttpContext context) =>
{
    var file = string.IsNullOrEmpty(path) ? "index.html" : path;
    if (context.Request.Host.Host != "127.0.0.1" || !assets.TryGetValue(file, out var resource))
        return Results.NotFound();

    context.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; " +
        "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers.CacheControl = file.StartsWith("assets/", StringComparison.Ordinal) ? "public, max-age=31536000, immutable" : "no-cache";
    contentTypes.TryGetContentType(file, out var contentType);
    return Results.Stream(assembly.GetManifestResourceStream(resource)!, contentType ?? "application/octet-stream");
});

await app.StartAsync();
var address = app.Services.GetRequiredService<IServer>()
    .Features.Get<IServerAddressesFeature>()!.Addresses.Single();
Console.OutputEncoding = System.Text.Encoding.UTF8;
Console.WriteLine($"LESchema: {address}");
Console.WriteLine("Оставьте это окно открытым. Чтобы завершить работу, закройте его.");

if (!args.Contains("--no-browser", StringComparer.Ordinal))
{
    try
    {
        Process.Start(new ProcessStartInfo(address) { UseShellExecute = true });
    }
    catch (Exception error) when (error is System.ComponentModel.Win32Exception or InvalidOperationException)
    {
        Console.Error.WriteLine($"Откройте указанный выше адрес в браузере. ({error.Message})");
    }
}

await app.WaitForShutdownAsync();
