using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;
using TableTennis.Api.Data;
using TableTennis.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

builder.Services.AddScoped<EloService>();
builder.Services.AddScoped<TournamentService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    // Patch existing databases to add TimeTrial schema (EnsureCreated handles fresh installs)
    var conn = db.Database.GetDbConnection();
    await conn.OpenAsync();
    using (var cmd = conn.CreateCommand())
    {
        // Add columns if they don't already exist (ALTER TABLE fails silently via try/catch)
        foreach (var sql in new[]
        {
            @"CREATE TABLE TimeTrialEntries (
                Id INT NOT NULL AUTO_INCREMENT,
                TournamentId INT NOT NULL,
                PlayerId INT NOT NULL,
                TimeMs INT NOT NULL,
                RecordedAt DATETIME(6) NOT NULL,
                PRIMARY KEY (Id),
                FOREIGN KEY (TournamentId) REFERENCES Tournaments(Id) ON DELETE CASCADE,
                FOREIGN KEY (PlayerId) REFERENCES Players(Id) ON DELETE RESTRICT
            )",
        })
        {
            try { cmd.CommandText = sql; await cmd.ExecuteNonQueryAsync(); } catch { }
        }
    }
    await conn.CloseAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthorization();
app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();
