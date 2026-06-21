namespace Web_uni_C_.Models
{
    public class RegistrarRequest
    {
        public int Dni { get; set; }
        public string Nombre { get; set; }
        public string Email { get; set; }
        public string? Telefono { get; set; }
        public string Carrera { get; set; }
        public int Ano { get; set; }
        public List<MateriaInscripcion> Materias { get; set; }
    }
    public class MateriaInscripcion
    {
        public string Id { get; set; }
        public string Modalidad { get; set; }
        
    }
    public class CambiarClaveRequest
    {
        [System.Text.Json.Serialization.JsonPropertyName("clave_actual")]
        public string? ClaveActual { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("clave_nueva")]
        public string? ClaveNueva { get; set; }
    }
    public class CambiarModalidadRequest
    {
        public int Dni { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("materia_id")]
        public string? MateriaId { get; set; }

        public string? Modalidad { get; set; }
        public string? Condicion { get; set; }
    }
}
