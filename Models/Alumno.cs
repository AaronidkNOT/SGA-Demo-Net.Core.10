namespace Web_uni_C_.Models
{
    public class Alumno
    {
        public int Dni { get; set; }
        public string Nombre { get; set; }
        public string Email { get; set; }
        public string? Telefono { get; set; }
        public string Carrera { get; set; }
        public string Clave { get; set; }
        public int  AnoCursado { get; set; }
        public DateTime? FechaCambioClave { get; set; }

    }
}
