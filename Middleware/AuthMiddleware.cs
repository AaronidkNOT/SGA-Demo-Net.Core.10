using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Web_uni_C_.Middleware
{
    public class AuthMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IConfiguration _config;

        public AuthMiddleware(RequestDelegate next, IConfiguration config)
        {
            _next = next;
            _config = config;
        }

        public async Task invoke(HttpContext context)
        {
            await _next(context);
        }

        // metodo de verificacion de token
        public static ClaimsPrincipal? VerificarToken(HttpContext context, IConfiguration config, string[] rolesPermitidos)
        {
            var token = context.Request.Cookies["sga_auth"];

            if(string.IsNullOrEmpty(token))
                return null;

            try
            {
                var clave = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(config["Jwt:Secret"]!)
                    );

                var validacion = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = clave,
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.Zero
                };

                var handler = new JwtSecurityTokenHandler();
                var principal = handler.ValidateToken(token, validacion, out _);

                var rol = principal.FindFirstValue("rol");
                if (rol == null || !rolesPermitidos.Contains(rol))
                    return null;

                    return principal;
            }
            catch
            {
                return null;
            }
        }
    }
}
