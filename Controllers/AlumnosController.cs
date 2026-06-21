using Dapper;
using Microsoft.AspNetCore.Mvc;
using Web_uni_C_.Middleware;
using Web_uni_C_.Models;
using Web_uni_C_.Services;
using static Org.BouncyCastle.Math.EC.ECCurve;
using System.Security.Claims;

namespace Web_uni_C_.Controllers
{
    [ApiController]
    public class AlumnosController : ControllerBase
    {
        private readonly AuthService _auth;
        private readonly DbConnection _db;
        private readonly EmailService _email;
        private readonly CorrelativasService _correlativas;
        private readonly IConfiguration _config;

        public AlumnosController(AuthService auth, DbConnection db, EmailService email, CorrelativasService correlativas, IConfiguration config)
        {
            _auth = auth;
            _db = db;
            _email = email;
            _correlativas = correlativas;
            _config = config;
        }

        [HttpPost("api/registrar")]
        public async Task<IActionResult> Registrar([FromBody] RegistrarRequest datos)
        {
            if (datos == null || datos.Dni <= 0 || string.IsNullOrEmpty(datos.Nombre) ||
                string.IsNullOrEmpty(datos.Email) || string.IsNullOrEmpty(datos.Carrera) ||
                datos.Materias == null || datos.Materias.Count == 0)

                return BadRequest(new { success = false, message = "Faltan datos obligatorios" });

            try
            {
                using var conn = _db.Crear();

                var config = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT valor FROM configuracion WHERE clave = 'inscripciones_abiertas'"
                );

                if (config == null || config.valor != "true")
                    return StatusCode(403, new { success = false, message = "Las inscripciones estan cerradas" });

                var aprobadas = await conn.QueryAsync<string>(
                    "SELECT materia_id FROM materias_aprobadas WHERE alumno_dni = @Dni",
                    new { datos.Dni }
                );
                var listadoAprobadas = aprobadas.ToList();

                foreach (var materia in datos.Materias)
                {
                    var falta = await _correlativas.ValidarCorrelativas(materia.Id, listadoAprobadas);
                    if (falta != null)
                    {
                        var nombreFalta = await conn.QueryFirstOrDefaultAsync<string>(
                            "SELECT nombre FROM materias WHERE id = @Id",
                            new { Id = falta }
                        );

                        return StatusCode(403, new
                        {
                            success = false,
                            message = $"Inscripcion rechazada. Debes la correlativa: {nombreFalta ?? falta}, si crees que esto es un error contacta con el instituto"
                        });
                    }
                }

                var claveGenerada = Convert.ToHexString(
                    System.Security.Cryptography.RandomNumberGenerator.GetBytes(4)
                ).ToUpper();

                var claveHasheada = _auth.HashearClave(claveGenerada);

                await conn.OpenAsync();
                using var transaction = await conn.BeginTransactionAsync();

                try
                {
                    var existente = await conn.QueryFirstOrDefaultAsync<dynamic>(
                        "SELECT dni, email, telefono FROM alumnos WHERE dni = @Dni OR email = @Email OR telefono = @Telefono FOR UPDATE",
                        new { datos.Dni, datos.Email, datos.Telefono },
                        transaction
                    );

                    if (existente != null)
                    {
                        await transaction.RollbackAsync();
                        if (existente.dni.ToString() == datos.Dni.ToString())
                            return StatusCode(403, new { success = false, message = "El DNI ya esta registrado, si crees que esto es un error contacta con el instituto" });
                        if (existente.email == datos.Email)
                            return StatusCode(403, new { success = false, message = "El email ya esta en uso, si crees que esto es un error contacta con el instituto" });
                        return StatusCode(403, new { success = false, message = "El telefono ya esta en uso, si crees que esto es un error contacta con el instituto" });
                    }

                    var alumnoExistente = await conn.QueryFirstOrDefaultAsync<dynamic>(
                        "SELECT ano_cursado FROM alumnos WHERE dni = @Dni",
                        new { datos.Dni },
                        transaction
                    );

                    if (alumnoExistente != null)
                    {
                        int anoCursado = (int)alumnoExistente.ano_cursado;
                        int anoMaxPermitido = anoCursado + 1;

                        if (datos.Ano > anoMaxPermitido)
                        {
                            await transaction.RollbackAsync();
                            return StatusCode(403, new
                            {
                                success = false,
                                message = $"Estas en {anoCursado}° año y solo podes inscribirte hasta {anoMaxPermitido}° año"
                            });
                        }
                    }

                    await conn.ExecuteAsync(
                        @"INSERT INTO alumnos (dni, nombre, email, telefono, carrera, clave, ano_cursado)
                        VALUES (@Dni, @Nombre, @Email, @Telefono, @Carrera, @Clave, @Ano)
                        ON DUPLICATE KEY UPDATE nombre=@Nombre, email=@Email, telefono=@Telefono,
                        carrera=@Carrera, clave=@Clave, ano_cursado=@Ano",
                        new { datos.Dni, datos.Nombre, datos.Email, datos.Telefono, datos.Carrera, Clave = claveHasheada, datos.Ano },
                        transaction
                    );

                    await conn.ExecuteAsync(
                        "DELETE FROM inscripciones WHERE alumno_dni = @Dni",
                        new { datos.Dni },
                        transaction
                    );

                    foreach (var materia in datos.Materias)
                    {
                        await conn.ExecuteAsync(
                            "INSERT INTO inscripciones (alumno_dni, materia_id, modalidad) VALUES (@Dni, @MateriaId, @Modalidad)",
                            new { datos.Dni, MateriaId = materia.Id, materia.Modalidad },
                            transaction
                        );
                    }

                    await transaction.CommitAsync();

                    _ = _email.EnviarBienvenidaAlumno(datos.Email, datos.Nombre, claveGenerada)
                        .ContinueWith(t => Console.WriteLine("Error email: " + t.Exception?.Message),
                        TaskContinuationOptions.OnlyOnFaulted);

                    return Ok(new { success = true, message = "Inscripcion exitosa" });
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

        [HttpGet("api/alumno/faltas")]
        public async Task<IActionResult> ObtenerFaltas()
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "alumno" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var dni = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            try
            {
                using var conn = _db.Crear();

                var materias = await conn.QueryAsync<dynamic>(
                    @"SELECT 
                        i.materia_id,
                        i.modalidad,
                        m.max_faltas,
                    COUNT(CASE WHEN a.estado = 'Ausente' THEN 1 END) as faltas
                        FROM inscripciones i
                        JOIN materias m ON m.id = i.materia_id
                        LEFT JOIN asistencias a ON a.alumno_dni = i.alumno_dni AND a.materia_id = i.materia_id
                        WHERE i.alumno_dni = @Dni
                    GROUP BY i.materia_id, i.modalidad, m.max_faltas",
                    new { Dni = dni }
                );

                return Ok(new { success = true, materias });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPut("api/inscripciones/modalidad")]
        public async Task<IActionResult> CambiarModalidad([FromBody] CambiarModalidadRequest datos)
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "alumno" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var dniToken = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            if (dniToken != datos.Dni)
                return StatusCode(403, new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();

                var inscripcion = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT modalidad FROM inscripciones WHERE alumno_dni = @Dni AND materia_id = @MateriaId",
                    new { Dni = datos.Dni, MateriaId = datos.MateriaId }
                );

                if (inscripcion == null)
                    return NotFound(new { success = false, message = "Inscripción no encontrada" });

                if ((string)inscripcion.modalidad == "LIBRE")
                    return StatusCode(403, new { success = false, message = "No podés cambiar la modalidad porque quedaste LIBRE por inasistencias" });

                await conn.ExecuteAsync(
                    "UPDATE inscripciones SET modalidad = @Modalidad WHERE alumno_dni = @Dni AND materia_id = @MateriaId",
                    new { datos.Modalidad, Dni = datos.Dni, MateriaId = datos.MateriaId }
                );

                return Ok(new { success = true, message = "Modalidad actualizada" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpDelete("api/inscripciones/{dni}/{materiaId}")]
        public async Task<IActionResult> DarDeBaja(int dni, string materiaId)
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "alumno" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var dniToken = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            if (dniToken != dni)
                return StatusCode(403, new { success = false, message = "No autorizado" });

            try
            {
                using var conn = _db.Crear();
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

        [HttpGet("api/alumno/perfil")]
        public async Task<IActionResult> ObtenerPerfil()
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "alumno" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var dni = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            try
            {
                using var conn = _db.Crear();

                var alumno = await conn.QuerySingleOrDefaultAsync<Alumno>(
                    "SELECT dni, nombre, email, telefono, carrera, ano_cursado FROM alumnos WHERE dni = @Dni",
                    new { Dni = dni }
                );

                if (alumno == null)
                    return NotFound(new { success = false, message = "Alumno no encontrado" });

                return Ok(new { success = true, alumno });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPut("api/alumno/cambiar-clave")]
        public async Task<IActionResult> CambiarClave([FromBody] CambiarClaveRequest datos)
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "alumno" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var dni = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);
            if (string.IsNullOrEmpty(datos.ClaveActual) || string.IsNullOrEmpty(datos.ClaveNueva))
                return BadRequest(new { success = false, message = "Faltan datos" });

            try
            {
                using var conn = _db.Crear();

                var alumno = await conn.QueryFirstOrDefaultAsync<Alumno>(
                    "SELECT clave FROM alumnos WHERE dni = @Dni",
                        new { Dni = dni }
                );

                if (alumno == null)
                    return NotFound(new { success = false, message = "Alumno no encontrado" });

                if (!_auth.VerificarClave(datos.ClaveActual, alumno.Clave))
                    return Unauthorized(new { success = false, message = "La clave actual es incorrecta" });

                var claveHasheada = _auth.HashearClave(datos.ClaveNueva);

                await conn.ExecuteAsync(
                    "UPDATE alumnos SET clave = @Clave, fecha_cambio_clave = @Fecha WHERE dni = @Dni",
                    new { Clave = claveHasheada, Fecha = DateTime.UtcNow, Dni = dni }
                    );

                return Ok(new { success = true, message = "Clave actualizada correctamente" });

            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpGet("api/alumno/notas")]
        public async Task<IActionResult> ObtenerNotas()
        {
            var user = AuthMiddleware.VerificarToken(HttpContext, _config, new[] { "alumno" });
            if (user == null)
                return Unauthorized(new { success = false, message = "No autorizado" });

            var dni = int.Parse(user.Claims.FirstOrDefault(c => c.Type == "dni")?.Value!);

            try
            {
                using var conn = _db.Crear();

                var notas = await conn.QueryAsync<dynamic>(
                    @"SELECT n.*, m.nombre as nombre_materia, m.duracion
                      FROM notas n
                      JOIN materias m ON m.id = n.materia_id
                      WHERE n.alumno_dni = @Dni",
                    new { Dni = dni }
                );

                return Ok(new { success = true, notas });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }
    }
}