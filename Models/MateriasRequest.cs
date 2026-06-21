using System.Text.Json.Serialization;

namespace Web_uni_C_.Models
{
    public class CorrelativaRequest
    {
        public string MateriaId { get; set; }
        public string RequiereMateriaId { get; set; }

    }

    public class FeriadoRequest
    {
        public DateOnly Fecha { get; set; }
        public string Motivo { get; set; }

    }

    public class HorarioRequest
    {
        [JsonPropertyName("materia_id")]
        public string? MateriaId { get; set; }

        [JsonPropertyName("carrera_id")]
        public string? CarreraId { get; set; }

        public int Ano { get; set; }

        [JsonPropertyName("dia_semana")]
        public int DiaSemana { get; set; }

        [JsonPropertyName("hora_inicio")]
        public TimeSpan HoraInicio { get; set; }

        [JsonPropertyName("hora_fin")]
        public TimeSpan HoraFin { get; set; }
    }

    public class ImportarFeriadosRequest
    {
        public int Anio { get; set; }
    }
}
