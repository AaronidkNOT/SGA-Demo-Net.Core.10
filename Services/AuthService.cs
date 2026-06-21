using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Web_uni_C_.Services
{
    public class AuthService
    {
        private readonly IConfiguration _config;

        public AuthService(IConfiguration config)
        {
            _config = config;
        }

        public string GenerarToken(int dni, string nombre, string rol)
        {
            var clave = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(_config["Jwt:Secret"]!)
            );

            var credenciales = new SigningCredentials(clave, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim("dni", dni.ToString()),
                new Claim("nombre", nombre),
                new Claim("rol", rol)
            };

            var expiracion = rol == "admin" ? DateTime.UtcNow.AddHours(2)
                           : rol == "profesor" ? DateTime.UtcNow.AddHours(4)
                           : DateTime.UtcNow.AddHours(8);

            var token = new JwtSecurityToken(
                claims: claims,
                expires: expiracion,
                signingCredentials: credenciales
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public string HashearClave(string clave)
        {
            return BCrypt.Net.BCrypt.HashPassword(clave, 10);
        }

        public bool VerificarClave(string clave, string hash)
        {
            return BCrypt.Net.BCrypt.Verify(clave, hash);
        }

        public string GenerarTokenCsrf()
        {
            return Convert.ToHexString(
                System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)
            );
        }

        public string GenerarTokenAdmin(string usuario)
        {
            var clave = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(_config["Jwt:Secret"]!)
                );
            var credenciales = new SigningCredentials(clave, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim("usuario", usuario),
                new Claim("rol", "admin")
            };
            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddHours(2),
                signingCredentials: credenciales
                );

            return new JwtSecurityTokenHandler().WriteToken( token );
        }
    }
}