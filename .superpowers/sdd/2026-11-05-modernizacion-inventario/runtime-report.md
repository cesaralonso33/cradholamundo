# Task 4 — Runtime central (Drizzle)

## Cambios

- `src/app.ts` comprueba PostgreSQL con Drizzle (`SELECT 1`) y conserva ambas rutas de health.
- Seeds idempotentes de admin, roles y catálogo inicial de papelería pasan por repositorios Drizzle/schema. Se conserva el requisito de `ADMIN_PASSWORD` en producción.
- `src/index.ts` ya no importa Prisma: la limpieza horaria elimina intentos antiguos mediante repositorio Drizzle y el shutdown cierra Fastify y el pool PostgreSQL.
- Se conservan plugins, CORS, cookies, Helmet, rate limit global, compresión, multipart, estáticos y todas las rutas.
- Se agregó una prueba de integración que crea una base PostgreSQL desechable, aplica `drizzle-kit migrate`, valida las dos rutas health, seeds en DB real y cierre del servidor.
- Se restauró `tests/health.test.ts`, preservando la comprobación original de `/health` y ampliándola a `/api/health`; ambas usan Drizzle y su propia base migrada desechable.
- `tests/integration/products.test.ts` ahora crea/migra/limpia una base temporal propia antes de preparar roles y usuarios; ya no depende del estado de la base entregada en `DATABASE_URL`.

## Verificación

- `npm run build`: pasa.
- RED: se ejecutó el test de productos existente contra PostgreSQL sin preparar: falló en setup con `no existe la relación «Role»` (línea 20), reproduciendo la dependencia de una base no migrada/contaminada.
- GREEN: luego del setup desechable/migrado, `npm test -- tests/integration/products.test.ts`: pasa (8/8).
- `npm test -- tests/health.test.ts tests/integration/runtime.test.ts`: pasa (6/6), contra bases PostgreSQL aisladas y migradas.
- Suite completa con `DATABASE_URL=postgresql://postgres@localhost:5432/postgres npm test`: pasa (12 archivos, 54/54), cada test de integración administra su propia base desechable.
- Se intentó el test sin `DATABASE_URL`: falla intencionalmente con mensaje explicativo; no se sustituyó PostgreSQL por mocks.

## Alcance pendiente / nota

Las dependencias Prisma permanecen instaladas en `package.json` para herramientas y compatibilidad histórica, pero el arranque runtime (`src/app.ts`/`src/index.ts`) no importa ni invoca Prisma. No se tocó OpenAPI central ni frontend.
