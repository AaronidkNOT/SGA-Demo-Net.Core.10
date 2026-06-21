using Org.BouncyCastle.Asn1.Mozilla;
using System.Text.Json.Serialization;

namespace Web_uni_C_.Models
{
    public class ConfiguracionRequest
    {
        public string Clave { get; set; }
        public string Valor { get; set; }
    }

    public class CrearProfesorRequest
    {
        public int Dni { get; set; }
        public string? Nombre { get; set; }
        public string? Clave { get; set; }
        public string? Email { get; set; }
        public bool ProratedarRecuperatorio { get; set; }
        public List<AsignacionRequest> Asignaciones { get; set; } = new();

    }

    public class AsignacionRequest
    {
        [JsonPropertyName("carrera_id")]
        public string? CarreraId { get; set; }

        public int Ano { get; set; }

        [JsonPropertyName("materia_id")]
        public string? MateriaId { get; set; }

        public string? Duracion { get; set; }
    }

    public class ActualizarNotaRequest
    {
        public int Dni { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("materia_id")]
        public string? MateriaId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("nuevo_estado")]
        public string? NuevoEstado { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("nueva_nota_final")]
        public decimal? NuevaNotaFinal { get; set; }

        public string? Accion { get; set; }
    }

    public class HistorialBulkRequest
    {
        [JsonPropertyName("alumno_dni")]
        public int Dni { get; set; }

        public string? Nombre { get; set; }
        public string? Carrera { get; set; }
        public string? Email { get; set; }
        public string? Telefono { get; set; }

        [JsonPropertyName("sigue_cursando")]
        public bool SigueCursando { get; set; }

        [JsonPropertyName("materias")]
        public List<HistorialItem> Items { get; set; } = new();
    }

    public class HistorialItem
    {
        [JsonPropertyName("id")]
        public string? MateriaId { get; set; }

        [JsonPropertyName("tipo")]
        public string? Estado { get; set; }

        public decimal? Nota { get; set; }

        [JsonPropertyName("modalidad")]
        public string? Modalidad { get; set; }

        public string? Duracion { get; set; }
    }
}
