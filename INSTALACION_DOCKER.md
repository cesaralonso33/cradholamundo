# Instalación Docker local

Solo para desarrollo/prueba local con datos ficticios. Requiere Docker Engine/Desktop y Compose v2.

1. Copia `.env.docker.example` a `.env` y sustituye `POSTGRES_PORT` (por defecto `55432`), `POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET` (32+ caracteres aleatorios), `ADMIN_PASSWORD` y `APP_PORT`. `DATABASE_URL` usa el host interno `db:5432`; el puerto externo `55432` evita conflictos con PostgreSQL del VPS. Codifica la contraseña como componente URI (`@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`, `%` → `%25`). No publiques `.env`.
2. Construir e iniciar: `docker compose up --build -d`.
3. Esperar que `docker compose ps` muestre `healthy` en `db`, `backend` y `frontend`; probar `curl http://localhost:<APP_PORT>/health`. El backend espera PostgreSQL saludable y frontend espera backend saludable.
4. Las migraciones Drizzle versionadas se aplican al arrancar el backend; no se ejecuta `db push` ni operación destructiva.
5. Detener preservando datos: `docker compose down`. Los volúmenes nombrados `pgdata` y `uploads` persisten. No ejecutar `down -v` para actualizar.

## Backup y restore PostgreSQL

Backup consistente en formato custom (recomendado):

```sh
docker compose exec -T db pg_dump -U postgres -d inventario -Fc > inventario-$(date +%F).dump
```

Restore sustituye la base completa: hacer backup primero y confirmar explícitamente el destino. Para una restauración limpia, parar backend y recrear únicamente la base `inventario` dentro del servicio correcto:

```sh
docker compose stop backend
docker compose exec db dropdb -U postgres --if-exists inventario
docker compose exec db createdb -U postgres inventario
docker compose exec -T db pg_restore -U postgres -d inventario --no-owner < inventario.dump
docker compose up -d backend
```

El restore del dump es destructivo para la base destino; nunca hacerlo sobre datos que deban conservarse. Respaldar también los archivos del volumen `uploads` por separado. No usar `docker compose down -v` como mecanismo de backup.

En esta ejecución Docker no está instalado, por lo que no se pudo construir ni arrancar contenedores. Antes de producción, usar TLS y gestión externa de secretos; este Compose no es por sí solo una configuración de producción endurecida.
