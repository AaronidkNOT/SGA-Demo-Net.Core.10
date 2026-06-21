namespace Web_uni_C_.Models
{
    public class Feriado
    {
        public int Id { get; set; }
        public DateOnly Fecha { get; set; }
        public string Motivo { get; set; }
        public string Tipo { get; set; }
    }

        public class FeriadoApi
        {
            public string? fecha { get; set; }
            public string? nombre { get; set; }
            public string? tipo { get; set; }
        }
}
