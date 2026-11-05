# Plan de migración

## Estado

Migración incremental completada en la copia independiente `C:\laragon\www\proyecto-modernizado`, salvo la verificación operativa de Docker, bloqueada porque Docker Engine/Compose no están instalados en el entorno actual.

## Fases ejecutadas

1. Línea base del sistema original y matriz funcional.
2. Traducción del esquema Prisma final de 13 modelos a Drizzle.
3. Migraciones versionadas y pruebas de integridad en PostgreSQL aislado.
4. Migración de autenticación, roles, usuarios, inventario, empleados, constancias, papelería, settings, backups y auditoría.
5. Eliminación de Prisma del runtime y del arranque.
6. Contrato OpenAPI 3.1, JSON/YAML servidos y pruebas de contrato.
7. Validación frontend Vue, Zod, errores centralizados, offline sync y formulario de movimientos.
8. E2E Playwright y seguridad sobre PostgreSQL aislado.
9. Docker Compose endurecido, migraciones Drizzle al arranque y documentación de recuperación.

## Estrategia de datos

- No se ejecutaron migraciones contra la base del proyecto original.
- La migración Drizzle crea el esquema desde cero y se validó con bases temporales.
- Para una base Prisma existente, hacer respaldo, comparar conteos/relaciones y ejecutar una migración de datos controlada antes de cambiar `DATABASE_URL`.
- Los respaldos seguros no contienen `password` ni `totp_secret` y no son restaurables como snapshot completo; el respaldo sensible requiere confirmación administrativa y se restaura solo en una operación admin.

## Criterios de salida

- Builds backend/frontend y suites automatizadas ejecutadas.
- E2E principales y seguridad ejecutadas contra servicios reales y PostgreSQL aislado.
- Docker Compose validado en un host que tenga Docker Engine/Compose v2. **Pendiente en este entorno.**
- Revisar `PROGRESO_MIGRACION.md`, `REPORTE_PRUEBAS.md` y `SEGURIDAD.md` antes de desplegar.

## Reanudación

1. Instalar Docker Engine con Compose v2 en un host aislado.
2. Copiar `.env.docker.example` a `.env` y establecer `DATABASE_URL` con contraseña URL-encoded, `POSTGRES_PASSWORD`, `JWT_SECRET` y `ADMIN_PASSWORD` fuertes.
3. Ejecutar `docker compose config`, `docker compose build` y `docker compose up -d`.
4. Verificar los tres healthchecks y ejecutar smoke/E2E contra la instancia recién creada.
