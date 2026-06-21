using Dapper;

namespace Web_uni_C_.Services
{
    public class CorrelativasService
    {
        private readonly DbConnection _db;
        private Dictionary<string, List<string>> _reglas = new();
        private DateTime _ultimaCarga = DateTime.MinValue;


        public CorrelativasService(DbConnection db)
        {
            _db = db;
        }

        // reglas de db y se guarda
        public async Task CargarReglas()
        {
            if ((DateTime.UtcNow - _ultimaCarga).TotalMinutes < 5)
                return;

            using var conn = _db.Crear();
            var rows = await conn.QueryAsync<dynamic>(
                "SELECT materia_id, requiere_materia_id FROM correlativas"
                );

            _reglas = new Dictionary<string, List<string>>();
            foreach (var row in rows)
            {
                string materia = row.materia_id;
                string requiere = row.requiere_materia_id;

                if (!_reglas.ContainsKey(materia))
                    _reglas[materia] = new List<string>();

                _reglas[materia].Add(requiere);
            }
            _ultimaCarga = DateTime.UtcNow;
        }

        public async Task<string?> ValidarCorrelativas(string materiaId, List<string> materiasAprobadas)
        {
            await CargarReglas();

            if (!_reglas.ContainsKey(materiaId))
                return null;

            foreach (var requiere in _reglas[materiaId])
            {
                if (!materiasAprobadas.Contains(requiere))
                    return requiere;
            }

            return null;
        }

        public bool AlumnoCumpleCorrelativa(string materiaId, List<string> materiasAprobadas)
        {
            if (!_reglas.ContainsKey(materiaId))
                return true;
            return _reglas[materiaId].All(req => materiasAprobadas.Contains(req));
        }
    }
}
