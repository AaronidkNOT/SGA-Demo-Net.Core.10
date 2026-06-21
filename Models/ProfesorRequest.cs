using System.Text.Json.Serialization;

namespace Web_uni_C_.Models
{
    public class GuardarNotasRequest
    {
        [JsonPropertyName("materia_id")]
        public string? MateriaId { get; set; }
        public bool ProratedarRecuperatorio { get; set; }
        public List<NotaAlumno> Notas { get; set; } = new();
    }
    public class NotaAlumno
    {
        public int Dni { get; set; }
        public decimal? P1 { get; set; }
        public decimal? P2 { get; set; }
        public decimal? R1 { get; set; }
        public decimal? R2 { get; set; }
        public decimal? Coloquio { get; set; }
        public decimal? Final { get; set; }
        public decimal? RFinal { get; set; }
    }
    public class AsistenciaRequest
    {
        [JsonPropertyName("materia_id")]
        public string? MateriaId { get; set; }
        public string? Fecha { get; set; }
        public List<AsistenciaAlumno> Asistencias { get; set; } = new();
    }
    public class AsistenciaAlumno
    {
        public int Dni { get; set; }
        public string Estado { get; set; }
    }
}
