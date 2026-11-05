# Informe Task 7 — Docker y despliegue

Fecha: 2026-11-05.

## Cambios

- Compose exige `POSTGRES_PASSWORD`, `JWT_SECRET` y `ADMIN_PASSWORD`; elimina defaults inseguros. PostgreSQL no publica puerto y persisten los volúmenes nombrados de datos/uploads.
- PostgreSQL tiene healthcheck `pg_isready`; backend espera DB saludable y comprueba `/health` (que valida DB); frontend espera backend saludable y comprueba HTTP.
- Backend aplica migraciones Drizzle versionadas con `drizzle-kit migrate` antes de iniciar; no se usa `db push` ni `--accept-data-loss`. El proceso runtime es no-root.
- Ejemplos `.env` y docs de instalación/despliegue describen secretos, healthchecks, volúmenes y backup/restore. Restore advierte que reemplaza la base destino; uploads requiere respaldo separado.
- Corrección posterior: backend ahora requiere `DATABASE_URL` explícita mediante Compose con host `db`; ya no la construye interpolando `POSTGRES_PASSWORD`. `.env.docker.example`, README, DEPLOY e instalación local documentan contraseña codificada como componente URI. Una prueba estática detecta la variable obligatoria, ausencia de concatenación y ejemplo con host `db`.

## Verificación ejecutada

- Backend `npm run build`: pasa.
- Frontend `npm run build`: pasa.
- Frontend `npm test`: 23/23.
- Backend `npm test`: sin PostgreSQL admin aislado; 19 passed, 42 skipped, 7 setup failures por falta de `DATABASE_URL` para crear bases temporales.
- Docker CLI no está instalado. `docker --version` y `docker compose version` bloquearon con: `docker : El término 'docker' no se reconoce como nombre de un cmdlet, función, archivo de script o programa ejecutable`. No se ejecutó validación nativa Compose/YAML, build o smoke test; runtime sin verificar.
- En esta corrección tampoco se ejecutó validación/build/smoke test Docker: CLI no disponible. La prueba estática local sí valida el contrato configurado; no sustituye `docker compose config`.
- Verificación de la corrección: `npm test -- tests/docker-config.test.ts` pasa (1/1); backend `npm run build` y `npm --prefix frontend run build` pasan; `npm --prefix frontend test` pasa (23/23). `npm test` completo se intentó, con 20 aprobados y 42 omitidos, pero falla en las suites DB/integración por no tener `DATABASE_URL`/PostgreSQL aislado (7 suites, incluyendo 7 casos de migraciones). `git diff --check` pasa.

## Persistencia/recuperación

`pgdata` almacena PostgreSQL y `uploads` los documentos. El procedimiento usa `pg_dump -Fc` y `pg_restore` tras detener backend y recrear explícitamente DB destino. Es destructivo: requiere backup previo y validar el proyecto. `docker compose down` conserva volúmenes; evitar `down -v` en actualizaciones.

## Pendiente

En host con Docker Engine/Compose v2, validar `docker compose config`, construir y levantar los tres servicios, verificar estados `healthy`, frontend/API y restauración en DB desechable.
