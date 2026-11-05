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
