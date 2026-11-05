# Instalación Docker local

Solo para desarrollo/prueba local con datos ficticios. Requiere Docker Engine/Desktop y Compose v2.

1. Desde esta copia independiente, crear `.env` local (no versionar) y establecer como mínimo `POSTGRES_PASSWORD`, `JWT_SECRET` (32+ caracteres aleatorios), `ADMIN_PASSWORD`, `COOKIE_SECRET` y `APP_PORT`. No usar valores por defecto del compose.
2. Construir e iniciar: `docker compose up --build -d`.
3. Comprobar: `docker compose ps`; `curl http://localhost:<APP_PORT>/health` (frontend sirve app; backend/API se enruta por Nginx según configuración). Revisar `docker compose logs backend db` si falla.
4. Detener preservando datos: `docker compose down`. Los volúmenes `pgdata` y `uploads` persisten.
5. Para eliminar los datos locales del entorno de prueba: únicamente tras confirmar el proyecto/volúmenes correctos, `docker compose down -v`.

La línea base de este documento no arrancó Docker ni validó health en contenedores. Antes de producción, eliminar defaults, usar TLS y reemplazar `prisma db push --accept-data-loss` por migraciones versionadas no destructivas; este Compose aún no constituye configuración de producción segura.
