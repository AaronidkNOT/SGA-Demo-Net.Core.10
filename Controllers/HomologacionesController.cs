using Dapper;
using Microsoft.AspNetCore.Mvc;
using Web_uni_C_.Middleware;
using Web_uni_C_.Models;

namespace Web_uni_C_.Controllers
{
    [ApiController]
    public class HomologacionesController : ControllerBase
    {
        private readonly DbConnection _db;
        private readonly IConfiguration _config;

        public HomologacionesController(DbConnection db, IConfiguration config)
        {
            _db = db;
            _config = config;
        }

        [HttpGet("api/admin/homologaciones")]
        public async Task<IActionResult> ObtenerHomologaciones()
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                var homologaciones = await conn.QueryAsync<dynamic>(
                    @"SELECT h.*, a.nombre as nombre_alumno, m.nombre as nombre_materia
                        FROM homologaciones h
                        JOIN alumnos a ON a.dni = h.alumno_dni
                        JOIN materias m ON m.id = h.materia_id
                        ORDER BY h.fecha DESC"
                );
                return Ok(new { success = true, homologaciones });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/admin/homologaciones")]
        public async Task<IActionResult> CrearHomologacion([FromBody] HomologacionRequest datos)
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                await conn.ExecuteAsync(
                    @"INSERT INTO homologaciones (alumno_dni, materia_id, nota, instituto_origen, observaciones, admin_usuario, fecha)
                        VALUES (@AlumnoDni, @MateriaId, @Nota, @InstitutoOrigen, @Observaciones, @AdminUsuario, NOW())",
                    new { datos.AlumnoDni, datos.MateriaId, datos.Nota, datos.InstitutoOrigen, datos.Observaciones, AdminUsuario = "admin" }
                );
                return Ok(new { success = true, message = "Homologación registrada" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpDelete("api/admin/homologaciones/{id}")]
        public async Task<IActionResult> EliminarHomologacion(int id)
        {
            if (AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" }) == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                await conn.ExecuteAsync("DELETE FROM homologaciones WHERE id = @Id", new { Id = id });
                return Ok(new { success = true, message = "Homologación eliminada" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }
    }
}