using Dapper;
using Microsoft.AspNetCore.Mvc;
using Web_uni_C_.Models;
using Web_uni_C_.Services;

namespace Web_uni_C_.Controllers
{
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AuthService _auth;
        private readonly DbConnection _db;

        public AuthController(AuthService auth, DbConnection db)
        {
            _auth = auth;
            _db = db;
        }

        [HttpPost("api/login")]
        public async Task<IActionResult> LoginAlumno([FromBody] LoginRequest datos)
        {
            if (datos == null || datos.Dni <= 0 || string.IsNullOrEmpty(datos.Clave))
                return BadRequest(new { success = false, message = "Faltan datos" });

            try
            {
                using var conn = _db.Crear();

                var alumno = await conn.QuerySingleOrDefaultAsync<Alumno>(
                    "SELECT * FROM alumnos WHERE dni = @Dni",
                    new { datos.Dni }
                );
                Console.WriteLine($"Nombre: {alumno?.Nombre}, Ano: {alumno?.AnoCursado}");
                if (alumno == null)
                    return Unauthorized(new { success = false, message = "DNI o clave incorrectos" });

                if (!_auth.VerificarClave(datos.Clave, alumno.Clave))
                    return Unauthorized(new { success = false, message = "DNI o clave incorrectos" });

                var inscripciones = await conn.QueryAsync<dynamic>(
                    @"SELECT i.alumno_dni, i.materia_id, i.modalidad, m.nombre as nombre_materia,
                        COUNT(CASE WHEN a.estado = 'Ausente' THEN 1 END) as faltas,
                            m.max_faltas
                        FROM inscripciones i
                        JOIN materias m ON m.id = i.materia_id
                        LEFT JOIN asistencias a ON a.alumno_dni = i.alumno_dni AND a.materia_id = i.materia_id
                        WHERE i.alumno_dni = @Dni
                    GROUP BY i.materia_id, i.modalidad, m.nombre, m.max_faltas",
                    new { datos.Dni }
                );

                var token = _auth.GenerarToken(alumno.Dni, alumno.Nombre, "alumno");
                var csrfToken = _auth.GenerarTokenCsrf();

                Response.Cookies.Append("sga_auth", token, new CookieOptions
                {
                    HttpOnly = true,
                    SameSite = SameSiteMode.Strict,
                    Expires = DateTimeOffset.UtcNow.AddHours(8)
                });

                Response.Cookies.Append("csrf_token", csrfToken, new CookieOptions
                {
                    HttpOnly = false,
                    SameSite = SameSiteMode.Strict,
                    Expires = DateTimeOffset.UtcNow.AddHours(8)
                });

                alumno.Clave = "";

                return Ok(new { success = true, alumno, materias = inscripciones, csrf_token = csrfToken });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/profesores/login")]
        public async Task<IActionResult> LoginProfesor([FromBody] LoginRequest datos)
        {
            if (datos == null || datos.Dni <= 0 || string.IsNullOrEmpty(datos.Clave))
                return BadRequest(new { success = false, message = "Faltan datos" });

            try
            {
                using var conn = _db.Crear();

                var profesor = await conn.QuerySingleOrDefaultAsync<Profesores>(
                    "SELECT * FROM profesores WHERE dni = @Dni",
                    new { datos.Dni }
                );

                if (profesor == null)
                    return Unauthorized(new { success = false, message = "DNI o clave incorrectos" });

                if (!_auth.VerificarClave(datos.Clave, profesor.Clave))
                    return Unauthorized(new { success = false, message = "DNI o clave incorrectos" });

                var asignaciones = await conn.QueryAsync<object>(
                    @"SELECT pa.*, m.nombre as nombre_materia, m.duracion
                        FROM profesor_asignaciones pa
                        JOIN materias m ON m.id = pa.materia_id
                        WHERE pa.profesor_dni = @Dni",
                    new { datos.Dni }
                );

                var token = _auth.GenerarToken(profesor.Dni, profesor.Nombre, "profesor");
                var csrfToken = _auth.GenerarTokenCsrf();

                Response.Cookies.Append("sga_auth", token, new CookieOptions
                {
                    HttpOnly = true,
                    SameSite = SameSiteMode.Strict,
                    Expires = DateTimeOffset.UtcNow.AddHours(4)
                });

                Response.Cookies.Append("csrf_token", csrfToken, new CookieOptions
                {
                    HttpOnly = false,
                    SameSite = SameSiteMode.Strict,
                    Expires = DateTimeOffset.UtcNow.AddHours(4)
                });

                profesor.Clave = "";

                return Ok(new { success = true, profesor, asignaciones, csrf_token = csrfToken });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/admin/login")]
        public async Task<IActionResult> LoginAdmin([FromBody] LoginAdminRequest datos)
        {
            if (datos == null || string.IsNullOrEmpty(datos.Usuario) || string.IsNullOrEmpty(datos.Clave))
                return BadRequest(new { success = false, message = "Faltan datos" });

            try
            {
                using var conn = _db.Crear();

                var admin = await conn.QuerySingleOrDefaultAsync<Admin>(
                    "SELECT * FROM usuarios_admin WHERE usuario = @Usuario",
                    new { datos.Usuario }
                );

                if (admin == null)
                    return Unauthorized(new { success = false, message = "Credenciales incorrectas" });

                if (!_auth.VerificarClave(datos.Clave, admin.Clave))
                    return Unauthorized(new { success = false, message = "Credenciales incorrectas" });

                var token = _auth.GenerarTokenAdmin(admin.Usuario);
                var csrfToken = _auth.GenerarTokenCsrf();

                Response.Cookies.Append("sga_auth", token, new CookieOptions
                {
                    HttpOnly = true,
                    SameSite = SameSiteMode.Strict,
                    Expires = DateTimeOffset.UtcNow.AddHours(2)
                });

                Response.Cookies.Append("csrf_token", csrfToken, new CookieOptions
                {
                    HttpOnly = false,
                    SameSite = SameSiteMode.Strict,
                    Expires = DateTimeOffset.UtcNow.AddHours(2)
                });

                return Ok(new { success = true, csrf_token = csrfToken });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error interno", detalle = ex.Message });
            }
        }

        [HttpPost("api/logout")]
        public IActionResult Logout()
        {
            Response.Cookies.Delete("sga_auth");
            Response.Cookies.Delete("csrf_token");
            return Ok(new { success = true });
        }
    }
}