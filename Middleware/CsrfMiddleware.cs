namespace Web_uni_C_.Middleware
{
    public class CsrfMiddleware
    {
        private readonly RequestDelegate _next;

        public CsrfMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task Invoke(HttpContext context)
        {
            var metodos = new[] { "POST", "PUT", "DELETE", "PATCH" };
            var excluidas = new[] { "/api/login", "/api/profesores/login", "/api/admin/login"};

            if (metodos.Contains(context.Request.Method) && !excluidas.Contains(context.Request.Path.Value))
            {
                var tokenHeader = context.Request.Headers["x-csrf-token"].ToString();
                var tokenCookie = context.Request.Cookies["csrf_token"];

                if (!string.IsNullOrEmpty(tokenCookie) && tokenHeader != tokenCookie)
                {
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsJsonAsync(new { success = false, message = "Token de seguridad inválido." });
                    return;
                }
            }
            await _next(context);
        }
    }
}