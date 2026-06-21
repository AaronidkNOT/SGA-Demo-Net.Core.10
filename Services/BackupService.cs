using Dapper;
using System.Text.Json;
using Bytewizer.Backblaze.Client;
using System.Text.Json;

namespace Web_uni_C_.Services
{
    public class BackupService
    {
        private readonly DbConnection _db;
        private readonly IConfiguration _config;

        public BackupService(DbConnection db, IConfiguration config)
        {
            _db = db;
            _config = config;
        }

        public async Task GenerarYSubirBackup()
        {
            using var conn = _db.Crear();

            var alumnos = await conn.QueryAsync<dynamic>("SELECT * FROM alumnos");
            var inscripciones = await conn.QueryAsync<dynamic>("SELECT * FROM inscripciones");
            var notas = await conn.QueryAsync<dynamic>("SELECT * FROM notas");
            var profesores = await conn.QueryAsync<dynamic>("SELECT dni, nombre FROM profesores");
            var correlativas = await conn.QueryAsync<dynamic>("SELECT * FROM correlativas");
            var horarios = await conn.QueryAsync<dynamic>("SELECT * FROM horarios");
            var feriados = await conn.QueryAsync<dynamic>("SELECT * FROM feriados");
            var homologaciones = await conn.QueryAsync<dynamic>("SELECT * FROM homologaciones");

            var backup = new
            {
                fecha = DateTime.Now,
                alumnos,
                inscripciones,
                notas,
                profesores,
                correlativas,
                horarios,
                feriados,
                homologaciones
            };

            var json = System.Text.Json.JsonSerializer.Serialize(backup, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
            var nombreArchivo = $"backup_{DateTime.Now:yyyy-MM-dd_HH-mm}.json";

            var carpeta = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "backups");
            Directory.CreateDirectory(carpeta);
            var rutaLocal = Path.Combine(carpeta, nombreArchivo);
            await File.WriteAllTextAsync(rutaLocal, json);

            try
            {
                var keyId = _config["Backblaze:KeyId"]!;
                var appKey = _config["Backblaze:AppKey"]!;
                var bucketId = _config["Backblaze:BucketId"]!;

                var client = new BackblazeClient();
                await client.ConnectAsync(keyId, appKey);

                var bytes = System.Text.Encoding.UTF8.GetBytes(json);
                using var stream = new MemoryStream(bytes);

                await client.UploadAsync(bucketId, $"backups/{nombreArchivo}", stream);

                Console.WriteLine($"Backup subido a Backblaze: {nombreArchivo}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error subiendo backup a Backblaze: {ex.Message}");
            }
        }
    }
}