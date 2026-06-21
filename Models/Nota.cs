namespace Web_uni_C_.Models
{
    public class Nota
    {
        public int AlumnoDni { get; set; }
        public string MateriaId { get; set; }
        public decimal? NotaP1 { get; set; }
        public decimal? NotaP2 { get; set; }
        public decimal? Recup2 { get; set; }
        public decimal? NotaColoquio { get; set; }
        public decimal? NotaFinal { get; set; }
        public decimal? RecupFinal { get; set; }
        public string EstadoAcademico { get; set; }
        public int UltimoEditorDni { get; set; }
        public DateTime? UltimaEdicion { get; set; }
    }
}
