using Dapper;
using Microsoft.AspNetCore.Mvc;
using Web_uni_C_.Middleware;
using Web_uni_C_.Models;
using Web_uni_C_.Services;

namespace Web_uni_C_.Controllers
{
    [ApiController]
    public class MateriasController : ControllerBase
    {
        private readonly DbConnection _db;
        private readonly IConfiguration _config;

        public MateriasController(DbConnection db, IConfiguration config)
        {
            _db = db;
            _config = config;
        }

        private static readonly Dictionary<string, string> PrefixCarrera = new()
        {
            { "geo", "geografia" },
            { "sis", "sistemas" },
            { "seg", "seguridad" },
            { "his", "historia" }
        };

        private static readonly Dictionary<string, (string nombre, int duracion)> CarrerasMeta = new()
        {
            { "geografia", ("Profesorado en Geografía", 4) },
            { "sistemas",  ("Tec. Sup. en Análisis Funcional de Sistemas Informáticos", 3) },
            { "seguridad", ("Tec. Sup. en Seguridad e Higiene", 3) },
            { "historia",  ("Profesorado de Historia", 4) }
        };

        [HttpGet("api/planes")]
        public async Task<IActionResult> ObtenerPlanes()
        {
            try
            {
                using var conn = _db.Crear();
                var materias = await conn.QueryAsync<dynamic>(
                    "SELECT id, nombre, duracion FROM materias ORDER BY id"
                );

                var planes = new Dictionary<string, object>();

                foreach (var materia in materias)
                {
                    string id = materia.id;
                    var partes = id.Split('_');
                    if (partes.Length < 3) continue;

                    if (!PrefixCarrera.TryGetValue(partes[0], out var claveCarrera)) continue;
                    if (!int.TryParse(partes[1], out var ano)) continue;
                    if (!CarrerasMeta.TryGetValue(claveCarrera, out var meta)) continue;

                    if (!planes.ContainsKey(claveCarrera))
                    {
                        planes[claveCarrera] = new
                        {
                            nombre = meta.nombre,
                            duracion = meta.duracion,
                            materias = new Dictionary<int, List<object>>()
                        };
                    }

                    var plan = (dynamic)planes[claveCarrera];
                    var dicMaterias = (Dictionary<int, List<object>>)plan.materias;

                    if (!dicMaterias.ContainsKey(ano))
                        dicMaterias[ano] = new List<object>();

                    dicMaterias[ano].Add(new
                    {
                        id = (string)materia.id,
                        nombre = (string)materia.nombre,
                        duracion = (string)(materia.duracion ?? "anual")
                    });
                }

                return Ok(new { success = true, planes });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/admin/correlativas")]
        public async Task<IActionResult> ObtenerCorrelativas()
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                var correlativas = await conn.QueryAsync<dynamic>("SELECT * FROM correlativas");
                return Ok(new { success = true, correlativas });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/admin/correlativas")]
        public async Task<IActionResult> CrearCorrelativa([FromBody] CorrelativaRequest datos)
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                await conn.ExecuteAsync(
                    "INSERT INTO correlativas (materia_id, requiere_materia_id) VALUES (@MateriaId, @RequiereMateriaId)",
                    new { datos.MateriaId, datos.RequiereMateriaId }
                );
                return Ok(new { success = true, message = "Correlativa agregada" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpDelete("api/admin/correlativas/{id}")]
        public async Task<IActionResult> EliminarCorrelativa(int id)
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                await conn.ExecuteAsync("DELETE FROM correlativas WHERE id = @Id", new { Id = id });
                return Ok(new { success = true, message = "Correlativa eliminada" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/admin/horarios")]
        public async Task<IActionResult> ObtenerHorarios()
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                var horarios = await conn.QueryAsync<dynamic>(
                    @"SELECT h.id, h.materia_id as materia_id, h.carrera_id, h.ano, h.dia_semana, 
                        h.hora_inicio, h.hora_fin, m.nombre as materia_nombre
                    FROM horarios h
                    JOIN materias m ON m.id = h.materia_id
                    ORDER BY h.dia_semana, h.hora_inicio"
                );
                return Ok(new { success = true, horarios });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/admin/horarios")]
        public async Task<IActionResult> CrearHorario([FromBody] HorarioRequest datos)
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                await conn.ExecuteAsync(
                    @"INSERT INTO horarios (materia_id, carrera_id, ano, dia_semana, hora_inicio, hora_fin)
                        VALUES (@MateriaId, @CarreraId, @Ano, @DiaSemana, @HoraInicio, @HoraFin)",
                    new { datos.MateriaId, datos.CarreraId, datos.Ano, datos.DiaSemana, datos.HoraInicio, datos.HoraFin }
                );
                return Ok(new { success = true, message = "Horario agregado" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpDelete("api/admin/horarios/{id}")]
        public async Task<IActionResult> EliminarHorario(int id)
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                await conn.ExecuteAsync("DELETE FROM horarios WHERE id = @Id", new { Id = id });
                return Ok(new { success = true, message = "Horario eliminado" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/admin/feriados")]
        public async Task<IActionResult> ObtenerFeriados()
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                var feriados = await conn.QueryAsync<dynamic>(
                    "SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha, motivo, tipo FROM feriados ORDER BY fecha"
                );
                return Ok(new { success = true, feriados });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/admin/feriados")]
        public async Task<IActionResult> CrearFeriado([FromBody] FeriadoRequest datos)
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                await conn.ExecuteAsync(
                    "INSERT INTO feriados (fecha, motivo, tipo) VALUES (@Fecha, @Motivo, @Tipo)",
                    new { datos.Fecha, datos.Motivo, Tipo = "manual" }
                );
                return Ok(new { success = true, message = "Feriado agregado" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpDelete("api/admin/feriados/{id}")]
        public async Task<IActionResult> EliminarFeriado(int id)
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                await conn.ExecuteAsync("DELETE FROM feriados WHERE id = @Id", new { Id = id });
                return Ok(new { success = true, message = "Feriado eliminado" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/admin/feriados/importar")]
        public async Task<IActionResult> ImportarFeriados([FromBody] ImportarFeriadosRequest datos)
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                var url = $"https://api.argentinadatos.com/v1/feriados/{datos.Anio}";
                using var http = new HttpClient();
                var response = await http.GetFromJsonAsync<List<FeriadoApi>>(url);

                if (response == null || response.Count == 0)
                    return Ok(new { success = false, message = "No se encontraron feriados" });

                using var conn = _db.Crear();
                int importados = 0;

                foreach (var f in response)
                {
                    var existe = await conn.ExecuteScalarAsync<int>(
                        "SELECT COUNT(*) FROM feriados WHERE fecha = @Fecha",
                        new { Fecha = f.fecha }
                    );

                    if (existe == 0)
                    {
                        await conn.ExecuteAsync(
                            "INSERT INTO feriados (fecha, motivo, tipo) VALUES (@Fecha, @Motivo, @Tipo)",
                            new { Fecha = f.fecha, Motivo = f.nombre, Tipo = f.tipo }
                        );
                        importados++;
                    }
                }

                return Ok(new { success = true, message = $"{importados} feriados importados" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }
    }
}