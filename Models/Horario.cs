namespace Web_uni_C_.Models
{
    public class Horario
    {
        public int Id { get; set; }
        public string MateriaId { get; set; }
        public string CarreraId { get; set; }
        public int Ano { get; set; }
        public int DiaSemana { get; set; }
        public TimeSpan HoraInicio { get; set; }
        public TimeSpan HoraFin { get; set; }
    }
}
