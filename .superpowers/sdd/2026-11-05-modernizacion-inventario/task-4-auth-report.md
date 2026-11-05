# Task 4 — Auth y administración

## Alcance realizado

- Migradas `src/routes/auth.ts`, `src/routes/users.ts` y `src/routes/roles.ts` de Prisma a Drizzle.
- Ampliados los repositorios Drizzle de usuarios/roles para lectura y escritura, conteos, listas de login y asignaciones por rol.
- Migradas las dependencias compartidas usadas por el dominio: `authenticate` (JWT y API key), permisos, auditoría y guardia persistente de intentos fallidos.
- Se mantuvieron endpoints, códigos/mensajes explícitos, cookie `token` y atributos por entorno, JWT de 7 días y temporal 2FA de 5 minutos, rate limits, permisos, y protecciones de último administrador.
- Añadida validación Zod a entradas de auth/users/roles; los errores de unicidad y FK de PostgreSQL se traducen a respuestas previas compatibles.
- La prueba de integración monta las rutas Fastify directamente contra una base PostgreSQL temporal creada/migrada desde la URL de administración, no utiliza mocks y elimina la base al terminar.

## Verificación

- RED de integración inicial: falló en la fixture por inferencia de `ARRAY[]`; corregida a `ARRAY[]::text[]`. Otro fallo expuso diferencias del wrapper de errores Drizzle (`cause.code`); añadido el mapeo de conflictos.
- `DATABASE_URL=postgresql://postgres@localhost:5432/inventario npx vitest run tests/integration/auth-admin.test.ts`: 3 tests pasan (login/cookie/audit, último admin, conflicto de rol).
- `npm run build`: pasa.

## Límites / notas

- `src/app.ts` y los dominios fuera de auth/administración aún usan Prisma por estar explícitamente fuera de este encargo; la suite de integración crea el Fastify mínimo para aislar las rutas migradas.
- No se cambió OpenAPI ni se publicaron artefactos externos.
- No se ejecutó la suite completa: hay pruebas existentes que dependen del esquema Prisma y arrancan a través de `app.ts`, que están fuera del alcance de esta tarea.

## Fix report — revisión auth/administración

- **RED reproducido:** una prueba PostgreSQL concurrente permitió que ambas demociones terminasen sin un único rechazo. Una prueba que provocó una excepción real en trigger de borrado recibió 404 en vez de 500. El API key tampoco autenticaba en la prueba aislada porque la validación todavía consultaba settings vía Prisma.
- Democión y eliminación ahora adquieren el mismo `pg_advisory_xact_lock` dentro de la transacción y vuelven a leer usuario/contar administradores bajo el lock antes de mutar. Pruebas concurrentes reales comprueban que no es posible demover ni borrar a los dos últimos administradores.
- Borrado de usuario ahora responde al FK conocido con el mensaje/código anterior, devuelve 404 únicamente si la fila no existe y relanza errores inesperados al error handler central (500 genérico).
- Validación de API key lee `api_enabled` y `api_key_hash` vía repositorio Drizzle, sin depender del módulo Prisma de settings.
- Añadida cobertura PostgreSQL real para enrolamiento/verificación y login 2FA, bloqueo persistido con `Retry-After`, API key, denegación por permisos, unicidad de usuario/rol, FK al borrar usuarios y fallo inesperado.
- **RED→GREEN:** `npx vitest run tests/integration/auth-admin.test.ts` inicialmente falla en concurrencia de democión y conversión a 404; tras el arreglo, la suite combinada pasa.
- **Verificación final:** `npm run build` pasa; `DATABASE_URL=postgresql://postgres@localhost:5432/inventario npx vitest run tests/integration/auth-admin.test.ts tests/services tests/db/migrations.test.ts` pasa, 24 tests en 5 archivos.
