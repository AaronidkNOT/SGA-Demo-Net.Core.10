namespace Web_uni_C_.Services
{
    public class NotasService
    {
        public string CalcularEstado(
            decimal? p1, decimal? r1,
            decimal? p2, decimal? r2,
            decimal? fin, decimal? rFin,
            decimal? coloquio,
            bool esCuatrimestral,
            bool promediarRecuperatorio,
            string? estadoPrevio)
        {
            // si ya estaba libre por asistencia, arranca libre
            string estado = estadoPrevio == "Libre" ? "Libre" : "Cursando";

            decimal vP1 = p1 ?? 0;
            decimal vR1 = r1 ?? 0;
            decimal vFin = Math.Max(fin ?? 0, rFin ?? 0);
            decimal? vColoquio = coloquio;

            if (esCuatrimestral)
            {
                // nota1 = P1 o promedio con R1 según flag
                decimal nota1;
                if (promediarRecuperatorio && vR1 > 0)
                    nota1 = (vP1 + vR1) / 2;
                else
                    nota1 = Math.Max(vP1, vR1);

                if (estado == "Libre")
                {
                    if (vFin >= 6) estado = "Aprobado (Final)";
                    else if (vFin > 0) estado = "Libre";
                }
                else if (nota1 > 0)
                {
                    decimal promEfectivo = vColoquio.HasValue
                        ? (nota1 + vColoquio.Value) / 2
                        : nota1;

                    if (promEfectivo >= 8)
                    {
                        estado = "Promocionado";
                    }
                    else if (promEfectivo >= 6)
                    {
                        estado = "Regular";
                        if (vFin >= 6) estado = "Aprobado (Final)";
                        else if (vFin > 0) estado = "Libre";

                        if (estado == "Regular" && vColoquio == null)
                            estado = "Coloquio Pendiente";
                    }
                    else
                    {
                        if (vFin >= 6) estado = "Aprobado (Final)";
                        else estado = "Libre";
                    }
                }
            }
            else
            {
                decimal vP2 = p2 ?? 0;
                decimal vR2 = r2 ?? 0;

                decimal nota1, nota2;
                if (promediarRecuperatorio && vR1 > 0)
                    nota1 = (vP1 + vR1) / 2;
                else
                    nota1 = Math.Max(vP1, vR1);

                if (promediarRecuperatorio && vR2 > 0)
                    nota2 = (vP2 + vR2) / 2;
                else
                    nota2 = Math.Max(vP2, vR2);

                if (estado == "Libre")
                {
                    if (vFin >= 6) estado = "Aprobado (Final)";
                    else if (vFin > 0) estado = "Libre";
                }
                else if (nota1 > 0 && nota2 > 0)
                {
                    decimal promEfectivo = vColoquio.HasValue
                        ? (nota1 + nota2 + vColoquio.Value) / 3
                        : (nota1 + nota2) / 2;

                    if (promEfectivo >= 8)
                    {
                        estado = "Promocionado";
                    }
                    else if (promEfectivo >= 6)
                    {
                        estado = "Regular";
                        if (vFin >= 6) estado = "Aprobado (Final)";
                        else if (vFin > 0) estado = "Libre";

                        if (estado == "Regular" && vColoquio == null)
                            estado = "Coloquio Pendiente";
                    }
                    else
                    {
                        if (vFin >= 6) estado = "Aprobado (Final)";
                        else estado = "Libre";
                    }
                }
            }

            return estado;
        }
    }
}