using Web_uni_C_.Jobs;
using Web_uni_C_.Middleware;
using Web_uni_C_.Services;

var builder = WebApplication.CreateBuilder(args);

// config
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        // Los <input type="number"> del frontend mandan el valor como string
        // (ej: {"dni":"22222222"}). Sin esto, System.Text.Json rechaza el string
        // para propiedades int (como LoginRequest.Dni) y devuelve 400 antes de
        // llegar al controller, lo que rompe el login de alumno y profesor.
        options.JsonSerializerOptions.NumberHandling =
            System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString;
    });

Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddScoped<Web_uni_C_.DbConnection>();
builder.Services.AddSingleton<AuthService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddScoped<CorrelativasService>();
builder.Services.AddSingleton<NotasService>();
builder.Services.AddSingleton<PdfService>();
builder.Services.AddSingleton<FeriadosService>();
builder.Services.AddHostedService<AsistenciasReminderJob>();
builder.Services.AddScoped<BackupService>();
builder.Services.AddHostedService<BackupJob>();

builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        options.TokenValidationParameters = new()
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
                System.Text.Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]!)
            ),
            ValidateIssuer = false,
            ValidateAudience = false
        };

        options.Events = new()
        {
            OnMessageReceived = ctx =>
            {
                ctx.Token = ctx.Request.Cookies["sga_auth"];
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

var origenes = builder.Configuration["Cors:Origins"]!.Split(',');
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(origenes)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "SGA API v1");
});

app.UseCors();
app.UseMiddleware<CsrfMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value;

    if (!path.Contains('.') && !path.StartsWith("/api"))
    {
        var htmlPath = Path.Combine("wwwroot", path.TrimStart('/') + ".html");
        if (File.Exists(htmlPath))
        {
            context.Request.Path = path + ".html";
        }
    }

    await next();
});

app.UseDefaultFiles();
app.UseStaticFiles();
app.MapControllers();

app.Run();