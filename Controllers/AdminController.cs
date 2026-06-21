using Dapper;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Web_uni_C_.Middleware;
using Web_uni_C_.Models;
using Web_uni_C_.Services;

namespace Web_uni_C_.Controllers
{
    [ApiController]
    public class AdminController : ControllerBase
    {
        private readonly DbConnection _db;
        private readonly AuthService _auth;
        private readonly EmailService _email;
        private readonly IConfiguration _config;

        public AdminController(DbConnection db, AuthService auth, EmailService email, IConfiguration config)
        {
            _db = db;
            _auth = auth;
            _email = email;
            _config = config;
        }

        private ClaimsPrincipal? VerificarAdmin()
        {
            return AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "admin" });
        }

        [HttpGet("api/admin/stats")]
        public async Task<IActionResult> ObtenerStats()
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();

                var totalAlumnos = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM alumnos");
                var totalProfes = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM profesores");
                var config = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT valor FROM configuracion WHERE clave = 'inscripciones_abiertas'"
                );

                return Ok(new
                {
                    success = true,
                    totalAlumnos,
                    totalProfes,
                    inscripcionesAbiertas = config?.valor ?? "false"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/admin/alumnos")]
        public async Task<IActionResult> ObtenerAlumnos()
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                var alumnos = await conn.QueryAsync<dynamic>(
                    "SELECT dni, nombre, email, telefono, carrera, ano_cursado FROM alumnos ORDER BY nombre"
                );
                return Ok(new { success = true, alumnos });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpDelete("api/admin/alumnos/{dni}")]
        public async Task<IActionResult> EliminarAlumno(int dni)
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                await conn.ExecuteAsync("DELETE FROM alumnos WHERE dni = @Dni", new { Dni = dni });
                return Ok(new { success = true, message = "Alumno eliminado" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/admin/profesores")]
        public async Task<IActionResult> ObtenerProfesores()
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                var profesores = await conn.QueryAsync<dynamic>(
                    @"SELECT p.dni, p.nombre, p.email, p.promediar_recuperatorio,
                             pa.materia_id, pa.carrera_id, pa.ano
                      FROM profesores p
                      LEFT JOIN profesor_asignaciones pa ON pa.profesor_dni = p.dni
                      ORDER BY p.nombre"
                );
                return Ok(new { success = true, profesores });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/admin/profesores")]
        public async Task<IActionResult> CrearProfesor([FromBody] CrearProfesorRequest datos)
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            if (datos == null || datos.Dni <= 0 || string.IsNullOrEmpty(datos.Nombre) || string.IsNullOrEmpty(datos.Clave))
                return BadRequest(new { success = false, message = "Faltan datos" });

            try
            {
                using var conn = _db.Crear();
                await conn.OpenAsync();
                using var transaction = await conn.BeginTransactionAsync();

                try
                {
                    var claveHasheada = _auth.HashearClave(datos.Clave);

                    await conn.ExecuteAsync(
                        @"INSERT INTO profesores (dni, nombre, clave, email, promediar_recuperatorio)
                          VALUES (@Dni, @Nombre, @Clave, @Email, @Promediar)
                          ON DUPLICATE KEY UPDATE nombre=@Nombre, clave=@Clave,
                          email=COALESCE(@Email, email), promediar_recuperatorio=@Promediar",
                        new { datos.Dni, datos.Nombre, Clave = claveHasheada, datos.Email, Promediar = datos.ProratedarRecuperatorio ? 1 : 0 },
                        transaction
                    );

                    await conn.ExecuteAsync(
                        "DELETE FROM profesor_asignaciones WHERE profesor_dni = @Dni",
                        new { datos.Dni }, transaction
                    );

                    foreach (var asig in datos.Asignaciones)
                    {
                        await conn.ExecuteAsync(
                            "UPDATE materias SET duracion = @Duracion WHERE id = @MateriaId",
                            new { asig.Duracion, MateriaId = asig.MateriaId }, transaction
                        );

                        await conn.ExecuteAsync(
                            @"INSERT INTO profesor_asignaciones (profesor_dni, carrera_id, ano, materia_id)
                              VALUES (@Dni, @CarreraId, @Ano, @MateriaId)",
                            new { datos.Dni, asig.CarreraId, asig.Ano, asig.MateriaId }, transaction
                        );
                    }

                    await transaction.CommitAsync();

                    if (!string.IsNullOrEmpty(datos.Email))
                    {
                        _ = _email.EnviarCredencialesProfesor(datos.Email, datos.Nombre, datos.Dni, datos.Clave)
                                  .ContinueWith(t => Console.WriteLine("Error email: " + t.Exception?.Message),
                                                TaskContinuationOptions.OnlyOnFaulted);
                    }

                    return Ok(new { success = true, message = "Profesor guardado correctamente" });
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

        [HttpDelete("api/admin/profesores/{dni}")]
        public async Task<IActionResult> EliminarProfesor(int dni)
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                await conn.ExecuteAsync("DELETE FROM profesores WHERE dni = @Dni", new { Dni = dni });
                return Ok(new { success = true, message = "Profesor eliminado" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/admin/configuracion")]
        public async Task<IActionResult> ObtenerConfiguracion()
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                var config = await conn.QueryAsync<dynamic>("SELECT clave, valor FROM configuracion");
                return Ok(new { success = true, config });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/admin/configuracion")]
        public async Task<IActionResult> GuardarConfiguracion([FromBody] ConfiguracionRequest datos)
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                await conn.ExecuteAsync(
                    "INSERT INTO configuracion (clave, valor) VALUES (@Clave, @Valor) ON DUPLICATE KEY UPDATE valor=@Valor",
                    new { datos.Clave, datos.Valor }
                );
                return Ok(new { success = true, message = "Configuracion guardada" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/admin/estadisticas")]
        public async Task<IActionResult> ObtenerEstadisticas()
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();

                var totalAlumnos = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM alumnos");
                var totalProfes = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM profesores");
                var totalInscripciones = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM inscripciones");
                var totalAprobados = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM notas WHERE estado_academico IN ('Aprobado (Cursada)', 'Aprobado (Final)')");
                var totalLibres = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM notas WHERE estado_academico = 'Libre'");
                var totalHomologaciones = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM homologaciones");

                var alumnosPorCarreraAno = await conn.QueryAsync<dynamic>(
                    "SELECT carrera, ano_cursado, COUNT(*) as total FROM alumnos GROUP BY carrera, ano_cursado ORDER BY carrera, ano_cursado"
                );

                var estadoAcademico = await conn.QueryAsync<dynamic>(
                    "SELECT estado_academico, COUNT(*) as total FROM notas GROUP BY estado_academico ORDER BY total DESC"
                );

                var aprobacionPorMateria = await conn.QueryAsync<dynamic>(
                    @"SELECT m.nombre as materia,
                        SUM(CASE WHEN n.estado_academico IN ('Aprobado (Cursada)', 'Aprobado (Final)') THEN 1 ELSE 0 END) as aprobados,
                        SUM(CASE WHEN n.estado_academico = 'Cursando' THEN 1 ELSE 0 END) as cursando,
                        SUM(CASE WHEN n.estado_academico = 'Libre' THEN 1 ELSE 0 END) as libres
                    FROM notas n
                    JOIN materias m ON m.id = n.materia_id
                    GROUP BY n.materia_id, m.nombre
                    ORDER BY aprobados DESC"
                );

                var enRiesgo = await conn.QueryAsync<dynamic>(
                    @"SELECT a.nombre, a.carrera, a.ano_cursado, m.nombre as materia_nombre,
                        COUNT(CASE WHEN asis.estado = 'Ausente' THEN 1 END) as faltas_actuales,
                        CASE WHEN i.modalidad = 'LIBRE' THEN 0
                            WHEN i.modalidad = 'CMI'   THEN 4
                            ELSE 3 END as max_faltas
                        FROM inscripciones i
                        JOIN alumnos a    ON a.dni = i.alumno_dni
                        JOIN materias m   ON m.id  = i.materia_id
                        LEFT JOIN asistencias asis ON asis.alumno_dni = i.alumno_dni AND asis.materia_id = i.materia_id
                        GROUP BY i.alumno_dni, i.materia_id
                        HAVING faltas_actuales >= max_faltas * 0.75 AND max_faltas > 0
                        ORDER BY faltas_actuales DESC"
                );

                return Ok(new
                {
                    success = true,
                    resumen = new
                    {
                        totalAlumnos,
                        totalProfes,
                        totalInscripciones,
                        totalAprobados,
                        totalLibres,
                        totalHomologaciones
                    },
                    alumnosPorCarreraAno,
                    estadoAcademico,
                    aprobacionPorMateria,
                    enRiesgo
                }); 
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/admin/toggle-inscripciones")]
        public async Task<IActionResult> ToggleInscripciones()
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                var actual = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT valor FROM configuracion WHERE clave = 'inscripciones_abiertas'"
                );

                var nuevoValor = actual?.valor == "true" ? "false" : "true";

                await conn.ExecuteAsync(
                    "INSERT INTO configuracion (clave, valor) VALUES ('inscripciones_abiertas', @Valor) ON DUPLICATE KEY UPDATE valor=@Valor",
                    new { Valor = nuevoValor }
                );

                return Ok(new { success = true, abiertas = nuevoValor == "true" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/admin/buscar-alumnos")]
        public async Task<IActionResult> BuscarAlumnos([FromQuery] string q)
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            if (string.IsNullOrEmpty(q))
                return Ok(new { success = true, alumnos = new List<object>() });

            try
            {
                using var conn = _db.Crear();

                var alumnos = await conn.QueryAsync<dynamic>(
                    @"SELECT dni, nombre, email, telefono, carrera, ano_cursado 
                        FROM alumnos 
                        WHERE dni LIKE @Q OR nombre LIKE @Q
                        ORDER BY nombre
                        LIMIT 20",
                    new { Q = $"%{q}%" }
                );

                return Ok(new { success = true, alumnos });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/admin/alumnos/{dni}/notas-completas")]
        public async Task<IActionResult> ObtenerNotasCompletas(int dni)
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();

                var notas = await conn.QueryAsync<dynamic>(
                    @"SELECT 
                        i.materia_id,
                        m.nombre as materia_nombre,
                        m.duracion,
                        COALESCE(n.estado_academico, 'Pendiente') as condicion_actual,
                        n.nota_p1, n.nota_p2, n.recup_p1, n.recup_p2,
                        n.nota_coloquio, n.nota_final, n.recup_final,
                        n.ultimo_editor_dni, n.ultima_edicion
                    FROM inscripciones i
                    JOIN materias m ON m.id = i.materia_id
                    LEFT JOIN notas n ON n.alumno_dni = i.alumno_dni AND n.materia_id = i.materia_id
                    WHERE i.alumno_dni = @Dni
                    ORDER BY i.materia_id",
                    new { Dni = dni }
                );

                return Ok(new { success = true, notas });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/admin/homologaciones/{dni}")]
        public async Task<IActionResult> ObtenerHomologacionesAlumno(int dni)
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                var homologaciones = await conn.QueryAsync<dynamic>(
                    @"SELECT h.*, m.nombre as nombre_materia
                        FROM homologaciones h
                        JOIN materias m ON m.id = h.materia_id
                        WHERE h.alumno_dni = @Dni
                        ORDER BY h.fecha DESC",
                    new { Dni = dni }
                );
                return Ok(new { success = true, homologaciones });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPut("api/admin/actualizar-nota")]
        public async Task<IActionResult> ActualizarNota([FromBody] ActualizarNotaRequest datos)
        {
            var admin = VerificarAdmin();
            if (admin == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var adminUsuario = admin.Claims.FirstOrDefault(c => c.Type == "usuario")?.Value ?? "admin";

            try
            {
                using var conn = _db.Crear();
                await conn.OpenAsync();
                using var transaction = await conn.BeginTransactionAsync();

                try
                {
                    var notaActual = await conn.QueryFirstOrDefaultAsync<dynamic>(
                        "SELECT estado_academico, nota_final FROM notas WHERE alumno_dni = @Dni AND materia_id = @MateriaId",
                        new { datos.Dni, datos.MateriaId }, transaction
                    );

                    await conn.ExecuteAsync(
                        @"INSERT INTO notas (alumno_dni, materia_id, estado_academico, nota_final)
                            VALUES (@Dni, @MateriaId, @Estado, @Nota)
                            ON DUPLICATE KEY UPDATE estado_academico=@Estado, nota_final=@Nota, ultima_edicion=NOW()",
                        new { datos.Dni, datos.MateriaId, Estado = datos.NuevoEstado, Nota = datos.NuevaNotaFinal },
                        transaction
                    );

                    await conn.ExecuteAsync(
                        @"INSERT INTO auditoria_notas (admin_usuario, alumno_dni, materia_id, accion, nota_anterior, nota_nueva, estado_anterior, estado_nuevo, fecha)
                            VALUES (@AdminUsuario, @Dni, @MateriaId, @Accion, @NotaAnterior, @NotaNueva, @EstadoAnterior, @EstadoNuevo, NOW())",
                        new
                        {
                            AdminUsuario = adminUsuario,
                            datos.Dni,
                            datos.MateriaId,
                            datos.Accion,
                            NotaAnterior = notaActual?.nota_final?.ToString() ?? "Sin nota",
                            NotaNueva = datos.NuevaNotaFinal?.ToString() ?? "Sin nota",
                            EstadoAnterior = notaActual?.estado_academico ?? "Pendiente",
                            EstadoNuevo = datos.NuevoEstado
                        },
                        transaction
                    );

                    await transaction.CommitAsync();
                    return Ok(new { success = true });
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

        [HttpGet("api/admin/alumnos/{dni}/boletin")]
        public async Task<IActionResult> ObtenerBoletin(int dni)
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();

                var alumno = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT dni, nombre, carrera, ano_cursado FROM alumnos WHERE dni = @Dni",
                    new { Dni = dni }
                );

                if (alumno == null)
                    return NotFound(new { success = false, message = "Alumno no encontrado" });

                var notas = await conn.QueryAsync<dynamic>(
                    @"SELECT 
                        i.materia_id,
                        m.nombre as materia_nombre,
                        m.duracion,
                        COALESCE(n.estado_academico, 'Pendiente') as condicion_actual,
                        n.nota_p1, n.nota_p2, n.recup_p1, n.recup_p2,
                        n.nota_coloquio, n.nota_final, n.recup_final
                    FROM inscripciones i
                    JOIN materias m ON m.id = i.materia_id
                    LEFT JOIN notas n ON n.alumno_dni = i.alumno_dni AND n.materia_id = i.materia_id
                    WHERE i.alumno_dni = @Dni
                    ORDER BY i.materia_id",
                    new { Dni = dni }
                );

                return Ok(new { success = true, alumno, notas });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/admin/auditoria/{dni}")]
        public async Task<IActionResult> ObtenerAuditoria(int dni)
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
                var auditoria = await conn.QueryAsync<dynamic>(
                    @"SELECT an.*, m.nombre as nombre_materia
                        FROM auditoria_notas an
                        JOIN materias m ON m.id = an.materia_id
                        WHERE an.alumno_dni = @Dni
                        ORDER BY an.fecha DESC",
                    new { Dni = dni }
                );
                return Ok(new { success = true, auditoria });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/admin/alumnos/{dni}/resetear-clave")]
        public async Task<IActionResult> ResetearClave(int dni)
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();

                var alumno = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT nombre, email FROM alumnos WHERE dni = @Dni",
                    new { Dni = dni }
                );

                if (alumno == null)
                    return NotFound(new { success = false, message = "Alumno no encontrado" });

                var claveNueva = Convert.ToHexString(
                    System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)
                ).ToUpper();

                var claveHasheada = _auth.HashearClave(claveNueva);

                await conn.ExecuteAsync(
                    "UPDATE alumnos SET clave = @Clave, fecha_cambio_clave = NOW() WHERE dni = @Dni",
                    new { Clave = claveHasheada, Dni = dni }
                );

                _ = _email.EnviarBienvenidaAlumno((string)alumno.email, (string)alumno.nombre, claveNueva)
                          .ContinueWith(t => Console.WriteLine("Error email: " + t.Exception?.Message),
                                        TaskContinuationOptions.OnlyOnFaulted);

                return Ok(new { success = true, message = "Clave reseteada y enviada por email", clave = claveNueva });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/admin/planilla-inscripciones")]
        public async Task<IActionResult> ObtenerPlanillaInscripciones([FromQuery] string carrera, [FromQuery] int ano)
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();

                var inscripciones = await conn.QueryAsync<dynamic>(
                    @"SELECT a.dni as alumno_dni, a.nombre as alumno_nombre,
                        i.materia_id, m.nombre as materia_nombre, i.modalidad
                            FROM alumnos a
                            JOIN inscripciones i ON i.alumno_dni = a.dni
                            JOIN materias m ON m.id = i.materia_id
                            WHERE a.carrera = @Carrera AND a.ano_cursado = @Ano
                            ORDER BY m.nombre, a.nombre",
                    new { Carrera = carrera, Ano = ano }
                );

                return Ok(new { success = true, inscripciones });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/admin/backup")]
        public async Task<IActionResult> GenerarBackup()
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            try
            {
                var backup = new BackupService(_db, _config);
                await backup.GenerarYSubirBackup();
                return Ok(new { success = true, message = "Backup generado y subido a Backblaze correctamente" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/admin/historial/bulk")]
        public async Task<IActionResult> GuardarHistorialBulk([FromBody] HistorialBulkRequest datos)
        {
            if (VerificarAdmin() == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            if (datos.Dni == 0 || string.IsNullOrEmpty(datos.Nombre) || string.IsNullOrEmpty(datos.Carrera))
                return BadRequest(new { success = false, message = "Faltan datos básicos (DNI, Nombre o Carrera)" });

            if (datos.SigueCursando && string.IsNullOrEmpty(datos.Email))
                return BadRequest(new { success = false, message = "Si sigue cursando, el Email es obligatorio" });

            try
            {
                using var conn = _db.Crear();
                await conn.OpenAsync();
                using var transaction = await conn.BeginTransactionAsync();

                try
                {
                    string? claveGenerada = null;

                    if (datos.SigueCursando)
                    {
                        claveGenerada = Convert.ToHexString(
                            System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)
                        ).ToUpper();
                        var claveHasheada = _auth.HashearClave(claveGenerada);

                        await conn.ExecuteAsync(
                            @"INSERT INTO alumnos (dni, nombre, email, telefono, carrera, clave)
                      VALUES (@Dni, @Nombre, @Email, @Telefono, @Carrera, @Clave)
                      ON DUPLICATE KEY UPDATE 
                        nombre    = @Nombre,
                        email     = COALESCE(@Email, email),
                        telefono  = COALESCE(@Telefono, telefono),
                        carrera   = @Carrera,
                        clave     = @Clave",
                            new { datos.Dni, datos.Nombre, datos.Email, datos.Telefono, datos.Carrera, Clave = claveHasheada },
                            transaction
                        );
                    }
                    else
                    {

                        await conn.ExecuteAsync(
                            @"INSERT INTO alumnos (dni, nombre, email, telefono, carrera)
                      VALUES (@Dni, @Nombre, @Email, @Telefono, @Carrera)
                      ON DUPLICATE KEY UPDATE 
                        nombre   = @Nombre,
                        email    = COALESCE(@Email, email),
                        telefono = COALESCE(@Telefono, telefono),
                        carrera  = @Carrera",
                            new { datos.Dni, datos.Nombre, datos.Email, datos.Telefono, datos.Carrera },
                            transaction
                        );
                    }

                    foreach (var item in datos.Items)
                    {
                        if (item.Estado == "historial")
                        {
                            await conn.ExecuteAsync(
                                @"INSERT INTO notas (alumno_dni, materia_id, estado_academico, nota_final)
                          VALUES (@Dni, @MateriaId, 'Aprobado (Final)', @Nota)
                          ON DUPLICATE KEY UPDATE estado_academico='Aprobado (Final)', nota_final=@Nota",
                                new { datos.Dni, item.MateriaId, item.Nota },
                                transaction
                            );
                        }
                        else if (item.Estado == "cursando")
                        {
                            await conn.ExecuteAsync(
                                @"INSERT INTO inscripciones (alumno_dni, materia_id, modalidad)
                          VALUES (@Dni, @MateriaId, @Modalidad)
                          ON DUPLICATE KEY UPDATE modalidad = @Modalidad",
                                new { datos.Dni, item.MateriaId, Modalidad = item.Modalidad ?? "CMC" },
                                transaction
                            );

                            await conn.ExecuteAsync(
                                @"INSERT INTO notas (alumno_dni, materia_id, estado_academico)
                          VALUES (@Dni, @MateriaId, 'Cursando')
                          ON DUPLICATE KEY UPDATE estado_academico='Cursando'",
                                new { datos.Dni, item.MateriaId },
                                transaction
                            );
                        }
                    }

                    await transaction.CommitAsync();

                    if (datos.SigueCursando && !string.IsNullOrEmpty(datos.Email) && claveGenerada != null)
                    {
                        _ = _email.EnviarBienvenidaAlumno(datos.Email, datos.Nombre, claveGenerada)
                                  .ContinueWith(t => Console.WriteLine("Error email: " + t.Exception?.Message),
                                                TaskContinuationOptions.OnlyOnFaulted);
                    }

                    return Ok(new
                    {
                        success = true,
                        message = $"Alumno guardado con {datos.Items.Count} materias cargadas."
                    });
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
    }
}