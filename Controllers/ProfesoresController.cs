using Dapper;
using System.Security.Claims;
using Web_uni_C_.Middleware;
using Web_uni_C_.Services;
using Microsoft.AspNetCore.Mvc;
using Web_uni_C_.Models;
namespace Web_uni_C_.Controllers
{
    [ApiController]
    public class ProfesoresController : ControllerBase
    {
        private readonly DbConnection _db;
        private readonly AuthService _auth;
        private readonly IConfiguration _config;
        private readonly NotasService _notas;

        public ProfesoresController(DbConnection db, AuthService auth, IConfiguration config, NotasService notas)
        {
            _db = db;
            _auth = auth;
            _config = config;
            _notas = notas;
        }

        // helper
        private async Task<bool> VerificarAsignacion(int dniProfesor, string materiaId)
        {
            using var conn = _db.Crear();
            var resultado = await conn.QueryFirstOrDefaultAsync<int?>(
                "SELECT id FROM profesor_asignaciones WHERE profesor_dni = @Dni AND materia_id = @MateriaId",
                new
                {
                    Dni = dniProfesor,
                    MateriaId = materiaId

                }
                );
            return resultado != null;     
        }

        [HttpGet("api/profesores/alumnos/{materiaId}")]
        public async Task<IActionResult> ObtenerAlumnos(string materiaId)
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "profesor" });
            if (user == null)
                return Unauthorized(new { success = false, message ="No autorizado" });

            var dni = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            if (!await VerificarAsignacion(dni, materiaId))
                return StatusCode(403, new { success = false, message = "No tenes acceso a esta materia" });
            try
            {
                using var conn = _db.Crear();

                var alumnos = await conn.QueryAsync<dynamic>(
                    @"SELECT a.dni, a.nombre, i.modalidad
                        FROM inscripciones i
                        JOIN alumnos a ON i.alumno_dni = a.dni
                        WHERE i.materia_id = @MateriaId
                        ORDER BY a.nombre",

                    new { MateriaId = materiaId }
                );

                return Ok(new { success = true, alumnos });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "error interno", detalles = ex.Message });
            }   
        }
        [HttpGet("api/profesores/notas/{materiaId}")]
        public async Task<IActionResult> ObtenerNotas(string materiaId)
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "profesor" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado"});

            var dni = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            if (!await VerificarAsignacion(dni, materiaId))
                return StatusCode(403, new { success = false, message = "No tenes acceso a esta materia" });

            try
            {
                using var conn = _db.Crear();

                var materiaInfo = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT duracion FROM materias WHERE id = @MateriaId",
                    new { MateriaId = materiaId }
                    );

                var alumnos = await conn.QueryAsync<dynamic>(
                    @"SELECT a.dni, a.nombre,
                            n.nota_p1, n.nota_p2, n.recup_p1, n.recup_p2,
                            n.estado_academico, n.nota_coloquio, n.nota_final,
                            n.recup_final, n.ultimo_editor_dni, n.ultima_edicion,
                            p.nombre AS nombre_ultimo_editor
                                FROM inscripciones i
                                JOIN alumnos a ON i.alumno_dni = a.dni
                                LEFT JOIN notas n ON n.alumno_dni = a.dni AND n.materia_id = i.materia_id
                                LEFT JOIN profesores p ON p.dni = n.ultimo_editor_dni
                                WHERE i.materia_id = @MateriaId
                                ORDER BY a.nombre",
                    new { MateriaId = materiaId }
                    );

                return Ok(new
                {
                    success = true,
                    alumnos,
                    duracion_materia = materiaInfo?.duracion ?? "anual"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalles = ex.Message });
            }
        }

        [HttpPost("api/profesores/notas/guardar")]
        public async Task<IActionResult> GuardarNotas([FromBody] GuardarNotasRequest datos)
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "profesor" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var dniProfesor = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            if (!await VerificarAsignacion(dniProfesor, datos.MateriaId!))
                return StatusCode(403, new { success = false, message = "No tenés acceso a esta materia" });

            try
            {
                using var conn = _db.Crear();
                await conn.OpenAsync();
                using var transaction = await conn.BeginTransactionAsync();

                try
                {
                    var matInfo = await conn.QueryFirstOrDefaultAsync<dynamic>(
                        "SELECT duracion FROM materias WHERE id = @MateriaId",
                        new { datos.MateriaId }, transaction
                    );

                    bool esCuatrimestral = matInfo != null && (string)matInfo.duracion != "anual";

                    var profe = await conn.QueryFirstOrDefaultAsync<dynamic>(
                        "SELECT promediar_recuperatorio FROM profesores WHERE dni = @Dni",
                        new { Dni = dniProfesor }, transaction
                    );
                    bool promediar = profe != null && Convert.ToInt32(profe.promediar_recuperatorio) == 1;

                    foreach (var n in datos.Notas)
                    {
                        var previo = await conn.QueryFirstOrDefaultAsync<dynamic>(
                            @"SELECT estado_academico, nota_p1, nota_p2, recup_p1, recup_p2,
                                nota_coloquio, nota_final, recup_final
                                FROM notas WHERE alumno_dni = @Dni AND materia_id = @MateriaId",
                            new { Dni = n.Dni, datos.MateriaId }, transaction
                        );

                        string estadoPrevio = previo?.estado_academico ?? "Cursando";

                        bool cambio = previo == null ||
                            (decimal?)previo.nota_p1 != n.P1 ||
                            (decimal?)previo.nota_p2 != n.P2 ||
                            (decimal?)previo.recup_p1 != n.R1 ||
                            (decimal?)previo.recup_p2 != n.R2 ||
                            (decimal?)previo.nota_final != n.Final ||
                            (decimal?)previo.recup_final != n.RFinal ||
                            (decimal?)previo.nota_coloquio != n.Coloquio;

                        if (!cambio) continue;

                        string estado = _notas.CalcularEstado(
                            n.P1, n.R1, n.P2, n.R2,
                            n.Final, n.RFinal, n.Coloquio,
                            esCuatrimestral, promediar, estadoPrevio
                        );

                        await conn.ExecuteAsync(
                            @"INSERT INTO notas (alumno_dni, materia_id, nota_p1, nota_p2, recup_p1, recup_p2,
                                         nota_coloquio, nota_final, recup_final, estado_academico,
                                         ultimo_editor_dni, ultima_edicion)
                                    VALUES (@AlumnoDni, @MateriaId, @P1, @P2, @R1, @R2, @Coloquio, @Final, @RFinal,
                                        @Estado, @EditorDni, NOW())
                                    ON DUPLICATE KEY UPDATE
                                        nota_p1=@P1, nota_p2=@P2, recup_p1=@R1, recup_p2=@R2,
                                        nota_coloquio=@Coloquio, nota_final=@Final, recup_final=@RFinal,
                                        estado_academico=@Estado, ultimo_editor_dni=@EditorDni, ultima_edicion=NOW()",
                            new
                            {
                                AlumnoDni = n.Dni,
                                datos.MateriaId,
                                P1 = n.P1,
                                P2 = esCuatrimestral ? null : n.P2,
                                R1 = n.R1,
                                R2 = esCuatrimestral ? null : n.R2,
                                n.Coloquio,
                                Final = n.Final,
                                RFinal = n.RFinal,
                                Estado = estado,
                                EditorDni = dniProfesor
                            },
                            transaction
                        );
                    }

                    await transaction.CommitAsync();
                    return Ok(new { success = true, message = "Notas guardadas correctamente" });
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/profesores/planilla/{materiaId}")]
        public async Task<IActionResult> ObtenerPlanilla(string materiaId)
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "profesor" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var dni = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            if (!await VerificarAsignacion(dni, materiaId))
                return StatusCode(403, new { success = false, message = "No tenes acceso a esta materia" });

            try
            {
                using var conn = _db.Crear();

                var registros = await conn.QueryAsync<dynamic>(
                    @"SELECT a.dni, a.nombre, i.modalidad,
                            DATE_FORMAT(asis.fecha, '%d/%m') as fecha_corta,
                            asis.estado
                                FROM inscripciones i
                                JOIN alumnos a ON i.alumno_dni = a.dni
                                LEFT JOIN asistencias asis ON a.dni = asis.alumno_dni AND asis.materia_id = i.materia_id
                                WHERE i.materia_id = @MateriaId
                                ORDER BY a.nombre, asis.fecha",
                    new { MateriaId = materiaId }
                );

                return Ok(new { success = true, registros });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/profesores/asistencia/fechas/{materiaId}")]
        public async Task<IActionResult> ObtenerFechasAsistencia(string materiaId)
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "profesor" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var dni = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            if (!await VerificarAsignacion(dni, materiaId))
                return StatusCode(403, new { success = false, message = "No tenes acceso a esta materia" });

            try
            {
                using var conn = _db.Crear();

                var fechas = await conn.QueryAsync<dynamic>(
                    "SELECT DISTINCT fecha FROM asistencias WHERE materia_id = @MateriaId ORDER BY fecha DESC",
                    new { MateriaId = materiaId }
                );

                return Ok(new { success = true, fechas });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/profesores/asistencia")]
        public async Task<IActionResult> GuardarAsistencia([FromBody] AsistenciaRequest datos)
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "profesor" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var dniProfesor = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            if (!await VerificarAsignacion(dniProfesor, datos.MateriaId!))
                return StatusCode(403, new { success = false, message = "No tenés acceso a esta materia" });

            try
            {
                using var conn = _db.Crear();

                foreach (var a in datos.Asistencias)
                {
                    await conn.ExecuteAsync(
                        @"INSERT INTO asistencias (alumno_dni, materia_id, fecha, estado)
                            VALUES (@Dni, @MateriaId, @Fecha, @Estado)
                            ON DUPLICATE KEY UPDATE estado = @Estado",
                        new { Dni = a.Dni, datos.MateriaId, datos.Fecha, a.Estado }
                    );
                }

                return Ok(new { success = true, message = "Asistencia guardada" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpDelete("api/profesores/baja/{dni}/{materiaId}")]
        public async Task<IActionResult> DarDeBaja(int dni, string materiaId)
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "profesor" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var dniProfesor = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            if (!await VerificarAsignacion(dniProfesor, materiaId))
                return StatusCode(403, new { success = false, message = "No tenés acceso a esta materia" });

            try
            {
                using var conn = _db.Crear();

                var otrosProfs = await conn.QueryAsync<dynamic>(
                    "SELECT profesor_dni FROM profesor_asignaciones WHERE materia_id = @MateriaId AND profesor_dni != @DniProfesor",
                    new { MateriaId = materiaId, DniProfesor = dniProfesor }
                );

                if (otrosProfs.Any())
                    return StatusCode(403, new
                    {
                        success = false,
                        message = "Esta materia tiene más de un profesor asignado. Las bajas deben gestionarse desde Administración"
                    });

                await conn.ExecuteAsync(
                    "DELETE FROM inscripciones WHERE alumno_dni = @Dni AND materia_id = @MateriaId",
                    new { Dni = dni, MateriaId = materiaId }
                );

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/profesores/asistencia/detalle/{materiaId}/{fecha}")]
        public async Task<IActionResult> ObtenerDetalleAsistencia(string materiaId, string fecha)
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "profesor" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var dni = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            if (!await VerificarAsignacion(dni, materiaId))
                return StatusCode(403, new { success = false, message = "No tenés acceso a esta materia" });

            try
            {
                using var conn = _db.Crear();

                var asistencias = await conn.QueryAsync<dynamic>(
                    @"SELECT a.alumno_dni as dni, alum.nombre, a.estado
                        FROM asistencias a
                        JOIN alumnos alum ON alum.dni = a.alumno_dni
                        WHERE a.materia_id = @MateriaId AND DATE(a.fecha) = @Fecha
                    ORDER BY alum.nombre",
                    new { MateriaId = materiaId, Fecha = fecha }
                );

                return Ok(new { success = true, asistencias });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }
    }
}