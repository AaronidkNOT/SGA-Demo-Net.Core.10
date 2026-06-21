using Microsoft.Extensions.Hosting;
using Web_uni_C_.Services;

namespace Web_uni_C_.Jobs
{
    public class BackupJob : BackgroundService
    {
        private readonly IServiceProvider _services;

        public BackupJob(IServiceProvider services)
        {
            _services = services;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var ahora = TimeZoneInfo.ConvertTime(DateTime.UtcNow,
                    TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires"));

                if (ahora.DayOfWeek == DayOfWeek.Sunday && ahora.Hour == 3 && ahora.Minute == 0)
                {
                    try
                    {
                        using var scope = _services.CreateScope();
                        var backup = scope.ServiceProvider.GetRequiredService<BackupService>();
                        await backup.GenerarYSubirBackup();
                        Console.WriteLine($"Backup automático generado: {ahora:dd/MM/yyyy HH:mm}");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error en backup automático: {ex.Message}");
                    }
                }

                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }
    }
}