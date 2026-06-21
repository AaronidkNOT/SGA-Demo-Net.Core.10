using System.Text.Json.Serialization;

namespace Web_uni_C_.Models
{
    public class HomologacionRequest
    {
        [JsonPropertyName("alumno_dni")]
        public int AlumnoDni { get; set; }

        [JsonPropertyName("materia_id")]
        public string? MateriaId { get; set; }

        public decimal? Nota { get; set; }

        [JsonPropertyName("instituto_origen")]
        public string? InstitutoOrigen { get; set; }

        public string? Observaciones { get; set; }
    }
}
