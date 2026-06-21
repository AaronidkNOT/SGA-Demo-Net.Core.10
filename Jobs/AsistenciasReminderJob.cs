using Dapper;
using Web_uni_C_.Services;

namespace Web_uni_C_.Jobs
{
    public class AsistenciasReminderJob : BackgroundService
    {
        private readonly IServiceProvider _services;

        public AsistenciasReminderJob(IServiceProvider services)
        {
            _services = services;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var ahora = TimeZoneInfo.ConvertTime(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires"));

                if (ahora.Hour == 10 && ahora.Minute == 0 && ahora.DayOfWeek != DayOfWeek.Saturday && ahora.DayOfWeek != DayOfWeek.Sunday)
                {
                    await VerificarAsistencias();
                }

                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

            }
        }
        private async Task VerificarAsistencias()
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<DbConnection>();
            var email = scope.ServiceProvider.GetRequiredService<EmailService>();

            using var conn = db.Crear();

            var hoy = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTime.UtcNow,
                TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires")));

            var esFeriado = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM feriados WHERE fecha = @Hoy",
                new { Hoy = hoy }
            );

            if (esFeriado > 0) return;

            int diaSemana = (int)hoy.DayOfWeek;

            var clasesHoy = await conn.QueryAsync<dynamic>(
                @"SELECT h.materia_id, h.profesor_dni, p.nombre as nombre_profesor, 
                p.email as email_profesor, m.nombre as nombre_materia
                    FROM horarios h
                        JOIN profesor_asignaciones pa ON pa.materia_id = h.materia_id
                        JOIN profesores p ON p.dni = pa.profesor_dni
                        JOIN materias m ON m.id = h.materia_id
                    WHERE h.dia_semana = @DiaSemana",
                new { DiaSemana = diaSemana }
            );

            foreach (var clase in clasesHoy)
            {

                var yaCargoAsistencias = await conn.ExecuteScalarAsync<int>(
                    "SELECT COUNT(*) FROM asistencias WHERE materia_id = @MateriaId AND DATE(fecha) = @Hoy",
                    new { MateriaId = (string)clase.materia_id, Hoy = hoy }
                );

                if (yaCargoAsistencias == 0 && !string.IsNullOrEmpty((string)clase.email_profesor))
                {
                    _ = email.EnviarRecordatorioAsistencia(
                        (string)clase.email_profesor,
                        (string)clase.nombre_profesor,
                        (string)clase.nombre_materia,
                        hoy.ToString("dd/MM/yyyy")
                    ).ContinueWith(t => Console.WriteLine("Error email cron: " + t.Exception?.Message),
                                   TaskContinuationOptions.OnlyOnFaulted);
                }
            }
        }
    }
}
