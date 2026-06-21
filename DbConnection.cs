using MySql.Data.MySqlClient;

namespace Web_uni_C_
{
    public class DbConnection
    {
        private readonly IConfiguration _config;

        public DbConnection(IConfiguration config)
        {
            _config = config;
        }

        public MySqlConnection Crear()
        {
            var host = _config["Database:Host"];
            var user = _config["Database:User"];
            var pass = _config["Database:Password"];
            var name = _config["Database:Name"];
            var port = _config["Database:Port"];

            var connectionString = $"Server={host};Port={port};Database={name};User={user};Password={pass};SslMode=Disabled;";
            return new MySqlConnection(connectionString);
        }
    }
}