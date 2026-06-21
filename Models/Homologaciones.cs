namespace Web_uni_C_.Models
{
    public class Homologaciones
    {
        public int Id { get; set; }
        public int AlumnoDni { get; set; }
        public string MateriaId { get; set; }
        public decimal? Nota { get; set; }
        public string InstitutoOrigen { get; set; }
        public string Observaciones { get; set; }
        public string AdminUsuario { get; set; }
        public DateTime? Fecha { get; set; }
    }
}
