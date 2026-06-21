# SGA — Sistema de Gestión Académica

Sistema de gestión académica para un instituto terciario real (ISP N°62), usado en producción por alumnos, profesores y administrativos. Esta es la versión backend en **ASP.NET Core (.NET 10)**, en proceso de alcanzar paridad de funcionalidades con la versión en producción (PHP).

> Pensado para mostrar cómo se resuelve, de punta a punta, un sistema académico real: inscripciones con validación de correlativas, carga de notas, control de asistencias, backups automáticos y auditoría de cambios.

---

## Probalo

Por ahora no hay un demo deployado en vivo — corré el proyecto local con Docker (ver más abajo, toma menos de 2 minutos).

**Credenciales demo** (todas con contraseña `Demo1234`):

| Rol       | Usuario                  |
|-----------|--------------------------|
| Admin     | `admin@demo.com`         |
| Profesor  | DNI `11111111`           |
| Alumno    | DNI `22222222`           |

---

## Stack tecnológico

- **Backend:** ASP.NET Core (.NET 10), Dapper, MySQL
- **Auth:** JWT en cookie httpOnly + token CSRF propio para métodos mutables
- **Jobs en background:** Hangfire / `IHostedService` (recordatorio de asistencias, backups automáticos)
- **Backups:** Backblaze B2 (subida automática programada)
- **Email:** MailKit (SMTP)
- **PDF:** QuestPDF
- **Frontend:** HTML/CSS/JS vanilla + Chart.js (sin framework, servido como archivos estáticos por la misma API)

---

## Historia del proyecto

El sistema arrancó en producción real para ~100-150 alumnos del ISP N°62. La primera versión se hizo en **Node.js**, después se migró por completo a **C# / ASP.NET Core** (aprendiendo el lenguaje en el proceso). Al momento de deployar, el hosting compartido (Ferozo) tenía el único slot de .NET ocupado por otro sistema del instituto — así que el proyecto se migró de nuevo, esta vez a **PHP 7.3**, reutilizando todo el frontend y la base MySQL ya existentes. Esa versión PHP es la que está en producción hoy.

Este repo es el regreso a C#: se está portando la versión PHP de vuelta a ASP.NET Core para tener una base más mantenible a largo plazo, sin perder lo aprendido (ni los datos) de las dos migraciones anteriores.

Lo interesante de esta historia no es la herramienta en sí, sino la traza de decisiones: cada migración respondió a una restricción real de infraestructura, no a preferencia técnica.

---

## Cómo correrlo localmente

### Opción 1: Docker Compose (recomendado)

Requiere Docker y Docker Compose instalados. Levanta la API + MySQL con un solo comando, y carga el esquema y los datos demo automáticamente la primera vez.

```bash
cp .env.example .env
# (opcional: editar .env si querés cambiar el JWT secret o las contraseñas)

docker compose up --build
```

La API queda escuchando en **http://localhost:8080**. Abrí esa URL en el navegador para acceder al sistema (admin, profesor, alumno).

Para resetear todo y volver a cargar los datos demo desde cero:

```bash
docker compose down -v
docker compose up --build
```

### Opción 2: Manual (sin Docker)

Requiere .NET 10 SDK y MySQL Server corriendo local.

```bash
mysql -u root -p < schema.sql
mysql -u root -p gestion_academica < seed_demo.sql

cd "Web uni C#"
dotnet user-secrets init
dotnet user-secrets set "Jwt:Secret" "un-secreto-cualquiera-para-probar"
dotnet user-secrets set "Database:Password" "tu-password-de-mysql"

dotnet run
```

La API queda en `http://localhost:5085` (ver `Properties/launchSettings.json`).

---

## Problemas técnicos que resolví

- **Lógica de promoción/regularidad/libre configurable**: el estado académico de cada alumno por materia (`Cursando`, `Aprobado (Cursada)`, `Aprobado (Final)`, `Libre`) se calcula según notas parciales, recuperatorios y coloquio, con reglas distintas por modalidad de cursada (CMC/CMI/Libre).
- **Validación de correlativas dinámica**: en vez de hardcodear qué materia depende de cuál, las correlativas viven en una tabla y se cargan en memoria con cache de 5 minutos (`CorrelativasService`), para no pegarle a la base en cada inscripción.
- **Alerta de alumnos en riesgo por ausentismo**: el límite de ausencias permitidas varía según la modalidad de cursada (libre = 0, CMI = 4, CMC = 3), calculado dinámicamente contra las asistencias reales.
- **Auditoría de cambios de notas**: cada modificación de nota o estado académico por parte de un admin queda registrada (quién, cuándo, valor anterior y nuevo) en `auditoria_notas`, para poder responder "quién cambió esto y por qué" sin tener que confiar en la memoria de nadie.
- **Backups automáticos**: un job en background sube backups de la base a Backblaze B2 de forma periódica, sin intervención manual.
- **Migraciones de stack guiadas por restricciones reales de hosting** (Node → C# → PHP → de nuevo C#), no por preferencia técnica — ver sección de historia arriba.

---

## Seguridad / estado del proyecto

Este es un proyecto en desarrollo activo, portado desde una versión PHP en producción. Cosas a tener en cuenta si lo evaluás como referencia:

- Las credenciales reales (JWT secret, SMTP, Backblaze) **no están en el repo** — ver `appsettings.json` (placeholders vacíos) y `.env.example`.
- El login no tiene todavía rate limiting activo (el paquete está instalado pero no conectado) — queda como mejora pendiente.
- Los datos de este repo son 100% ficticios (`seed_demo.sql`). Ningún dato real de alumnos del ISP N°62 se sube nunca a este repositorio.

---

## Estructura

```
Web uni c#/
├── Controllers/      # Endpoints de la API (alumnos, profesores, admin, materias, etc.)
├── Services/         # Lógica de negocio (auth, notas, correlativas, backups, email)
├── Middleware/        # CSRF y verificación de JWT
├── Models/           # DTOs y modelos de datos
├── Jobs/             # Tareas en background (recordatorios, backups)
├── wwwroot/          # Frontend (HTML/CSS/JS vanilla)
├── schema.sql        # Esquema de base de datos
├── seed_demo.sql      # Datos demo ficticios
└── docker-compose.yml
```

---

## Licencia

MIT — usalo, copialo, aprendé de él. Si encontrás algo que se puede mejorar, los issues y PRs son bienvenidos.
