using Microsoft.EntityFrameworkCore;
using SupportTicketSystem.Data;
using SupportTicketSystem.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using SupportTicketSystem.Services;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Most PaaS hosts (Render, Railway, Heroku-style buildpacks) assign a
// port at container start via the $PORT env var and route external
// traffic to it - they don't know or care about Kestrel's local-dev
// default. Locally, PORT is unset, so this is a no-op and launchSettings/
// appsettings control the port as before.
var platformPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(platformPort)) {
    builder.WebHost.UseUrls($"http://0.0.0.0:{platformPort}");
}

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var frontendOrigin = builder.Configuration["Cors:FrontendOrigin"] ?? "http://localhost:5173";
builder.Services.AddCors(options => {
    options.AddPolicy("Frontend", policy => {
        policy.WithOrigins(frontendOrigin)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});
builder.Services.AddHttpClient<IRagServiceClient, RagServiceClient>(client => {
    client.BaseAddress = new Uri(builder.Configuration["RagService:BaseUrl"]!);
    client.Timeout = TimeSpan.FromSeconds(10);
});
builder.Services.AddHttpClient<IKnowledgeBaseClient, KnowledgeBaseClient>(client => {
    client.BaseAddress = new Uri(builder.Configuration["RagService:BaseUrl"]!);
    // Longer than classification's timeout: ingestion chunks the document
    // and embeds every chunk before responding, so it scales with
    // document size rather than being a single fixed-cost call.
    client.Timeout = TimeSpan.FromSeconds(60);
});
builder.Services.AddHttpClient<IRagGenerationClient, RagGenerationClient>(client => {
    client.BaseAddress = new Uri(builder.Configuration["RagService:BaseUrl"]!);
    // Embedding + FAISS search + one LLM completion call - longer than a
    // single classification call, but this is triggered explicitly by an
    // agent opening a ticket or clicking "Regenerate", not automatically
    // on every request, so a longer timeout is acceptable here.
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddHttpClient<IInsightsSummaryClient, InsightsSummaryClient>(client => {
    client.BaseAddress = new Uri(builder.Configuration["RagService:BaseUrl"]!);
    client.Timeout = TimeSpan.FromSeconds(15);
});
// Backs the 1-hour weekly-insights cache in AdminController. In-memory
// (rather than a DB-backed cache table) is a deliberate, simple choice
// here: this app runs as a single instance, the cached value is small,
// and losing the cache on a restart just means the next request pays
// for one fresh generation - there's no correctness requirement that
// justifies the extra complexity of persisting it.
builder.Services.AddMemoryCache();
// Scoped (not singleton) since both wrap the request-scoped AppDbContext -
// see their own comments for why they queue onto it rather than saving
// independently.
builder.Services.AddScoped<IAuditLogger, AuditLogger>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(NormalizePostgresConnectionString(
                builder.Configuration.GetConnectionString("DefaultConnection")!)));
builder.Services.AddIdentity<ApplicationUser, IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();
builder.Services.AddAuthentication(options => {
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options => {
    options.TokenValidationParameters = new TokenValidationParameters {
        ValidateIssuerSigningKey  = true,
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"])
        ),
        ValidateIssuer = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = true,
        ValidAudience = builder.Configuration["Jwt:Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});
var app = builder.Build();

var adminEmail = builder.Configuration["SeedAdmin:Email"];
var adminPassword = builder.Configuration["SeedAdmin:Password"];

using (var scope = app.Services.CreateScope()){
    var services = scope.ServiceProvider;

    // Applies any pending EF Core migrations automatically at startup,
    // rather than relying on `dotnet ef database update` as a separate
    // manual step. This matters most for deployment: a freshly deployed
    // container has no way to run the `dotnet-ef` CLI tool (it isn't
    // published with the app), so the schema needs to be brought up to
    // date from inside the running app itself. It also sidesteps the
    // Windows Smart App Control issue that repeatedly blocked the `ef`
    // CLI's assembly load during local development (see project history) -
    // Migrate() runs through the app's own already-trusted process
    // instead of spawning a separate tool.
    var dbContext = services.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();

    var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
    var existingAdmin = await userManager.FindByEmailAsync(adminEmail);

    string[] roleNames = {"Admin", "Agent", "User"};

    foreach (var roleName in roleNames) {
        var roleExist = await roleManager.RoleExistsAsync(roleName);
        if (!roleExist) {
            await roleManager.CreateAsync(new IdentityRole(roleName));
        }
    }

    if(existingAdmin == null) {
            var newAdmin = new ApplicationUser {
            UserName = adminEmail,
            Email = adminEmail
        };

        var result = await userManager.CreateAsync(newAdmin, adminPassword);
        await userManager.AddToRoleAsync(newAdmin, "Admin");
    }
    
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("Frontend");

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.Run();

// Render (and most managed Postgres hosts) hand out a connection string
// as a `postgres://user:pass@host:port/dbname` URI, but Npgsql's native
// format is semicolon-delimited `key=value` pairs, not a URI - so a URI
// passed straight through would fail to parse. This converts one to the
// other when needed, so the exact same env var value works whether it
// came from Render's dashboard (URI form) or was typed by hand locally
// in the classic keyword/value form.
static string NormalizePostgresConnectionString(string connectionString) {
    if (!connectionString.StartsWith("postgres://") && !connectionString.StartsWith("postgresql://")) {
        return connectionString;
    }

    var uri = new Uri(connectionString);
    var userInfo = uri.UserInfo.Split(':', 2);

    var builder = new NpgsqlConnectionStringBuilder {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Database = uri.AbsolutePath.TrimStart('/'),
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
        // Render's managed Postgres requires an encrypted connection.
        SslMode = SslMode.Require,
    };

    return builder.ToString();
}
