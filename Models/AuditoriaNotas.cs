namespace Web_uni_C_.Models
{
    public class AuditoriaNotas
    {
        public int Id { get; set; }
        public string AdminUsuario { get; set; }
        public int AlumnoDni { get; set; }
        public string Materiaid { get; set; }
        public string Accion { get; set; }
        public decimal? NotaAnterior { get; set; }
        public decimal? NotaNueva { get; set; }
        public string EstadoAnterior { get; set; }
        public string EstadoNuevo { get; set; }
        public DateTime? Fecha { get; set; }
    }
}
