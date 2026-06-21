namespace Web_uni_C_.Models
{
    public class LoginRequest
    {
        public int Dni {  get; set; }
        public string Clave { get; set; }
    }

    public class LoginAdminRequest
    {
        public string Usuario { get; set; }
        public string Clave { get; set; }
    }
}
