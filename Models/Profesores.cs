namespace Web_uni_C_.Models
{
    public class Profesores
    {
        public int Dni { get; set; }
        public string Nombre { get; set; }
        public string Email { get; set; }
        public string Clave { get; set; }
        public bool PromediarRecuperatorio { get; set; }
        public DateTime? FechaCambioClave { get; set; }

    }
}
