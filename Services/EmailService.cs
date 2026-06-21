using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Web_uni_C_.Services
{
    public class EmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config)
        {
            _config = config;
        }

        private async Task<SmtpClient> ConectarSmtp()
        {
            var client = new SmtpClient();
            await client.ConnectAsync("smtp.gmail.com", 587, SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(
                _config["Email:User"],
                _config["Email:Password"]
            );
            return client;
        }

        public async Task EnviarBienvenidaAlumno(string email, string nombre, string clave)
        {
            var mensaje = new MimeMessage();
            mensaje.From.Add(MailboxAddress.Parse(_config["Email:User"]));
            mensaje.To.Add(MailboxAddress.Parse(email));
            mensaje.Subject = "Tu clave de acceso - SGA";

            mensaje.Body = new TextPart("html")
            {
                Text = $@"
                    <div style='font-family: sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 10px;'>
                        <h2 style='color: #2563eb;'>¡Inscripción Exitosa!</h2>
                        <p>Hola <strong>{nombre}</strong>, tu cuenta ha sido creada.</p>
                        <p>Tu clave de acceso al portal es:</p>
                        <div style='background: #f3f4f6; padding: 15px; font-size: 24px; font-weight: bold; text-align: center;'>
                            {clave}
                        </div>
                        <p style='color: #666; font-size: 0.8em;'>Usá tu DNI y esta clave para ingresar.</p>
                    </div>"
            };

            using var smtp = await ConectarSmtp();
            await smtp.SendAsync(mensaje);
            await smtp.DisconnectAsync(true);
        }

        public async Task EnviarCredencialesProfesor(string email, string nombre, int dni, string clave)
        {
            var mensaje = new MimeMessage();
            mensaje.From.Add(MailboxAddress.Parse(_config["Email:User"]));
            mensaje.To.Add(MailboxAddress.Parse(email));
            mensaje.Subject = "Acceso al portal de profesores - SGA";

            mensaje.Body = new TextPart("html")
            {
                Text = $@"
                    <div style='font-family: sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 10px;'>
                        <h2 style='color: #2563eb;'>Bienvenido/a al Portal de profesores</h2>
                        <p>Hola <strong>{nombre}</strong>, se creó tu cuenta de acceso.</p>
                        <p>Tus credenciales son:</p>
                        <p><strong>Usuario (DNI):</strong> {dni}</p>
                        <p><strong>Contraseña:</strong> {clave}</p>
                        <p style='color: #666; font-size: 0.85em;'>La clave es unica, por lo que se recomienda guardarla en un lugar seguro</p>
                    </div>"
            };

            using var smtp = await ConectarSmtp();
            await smtp.SendAsync(mensaje);
            await smtp.DisconnectAsync(true);
        }


        public async Task EnviarRecordatorioAsistencia(string email, string nombreProfesor, string nombreMateria, string fecha)
        {
            var mensaje = new MimeMessage();
            mensaje.From.Add(MailboxAddress.Parse(_config["Email:User"]));
            mensaje.To.Add(MailboxAddress.Parse(email));
            mensaje.Subject = "Recordatorio: Asistencias pendientes - SGA";

            mensaje.Body = new TextPart("html")
            {
                Text = $@"
                    <div style='font-family: sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 10px;'>
                        <h2 style='color: #f59e0b;'>Asistencias pendientes</h2>
                        <p>Hola <strong>{nombreProfesor}</strong>,</p>
                        <p>No registraste asistencias para <strong>{nombreMateria}</strong> el día <strong>{fecha}</strong>.</p>
                        <p>Por favor ingresá al portal y completá el registro.</p>
                    </div>"
            };

            using var smtp = await ConectarSmtp();
            await smtp.SendAsync(mensaje);
            await smtp.DisconnectAsync(true);
        }
    }
}
