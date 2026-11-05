# Task 4 — Runtime central (Drizzle)

## Cambios

- `src/app.ts` comprueba PostgreSQL con Drizzle (`SELECT 1`) y conserva ambas rutas de health.
- Seeds idempotentes de admin, roles y catálogo inicial de papelería pasan por repositorios Drizzle/schema. Se conserva el requisito de `ADMIN_PASSWORD` en producción.
- `src/index.ts` ya no importa Prisma: la limpieza horaria elimina intentos antiguos mediante repositorio Drizzle y el shutdown cierra Fastify y el pool PostgreSQL.
- Se conservan plugins, CORS, cookies, Helmet, rate limit global, compresión, multipart, estáticos y todas las rutas.
- Se agregó una prueba de integración que crea una base PostgreSQL desechable, aplica `drizzle-kit migrate`, valida las dos rutas health, seeds en DB real y cierre del servidor.

## Verificación

- `npm run build`: pasa.
- `DATABASE_URL=postgresql://postgres@localhost:5432/postgres npm test -- tests/integration/runtime.test.ts`: pasa (4/4) contra PostgreSQL aislado y migrado.
- Se intentó el test sin `DATABASE_URL`: falla intencionalmente con mensaje explicativo; no se sustituyó PostgreSQL por mocks.
- Suite completa: 44 pruebas pasaron y 8 quedaron saltadas; falló `tests/integration/products.test.ts` en su setup porque usa la base por defecto y no encuentra la relación `Role`. La prueba runtime dedicada sí pasó completa en su base desechable.

## Alcance pendiente / nota

Las dependencias Prisma permanecen instaladas en `package.json` para herramientas y compatibilidad histórica, pero el arranque runtime (`src/app.ts`/`src/index.ts`) no importa ni invoca Prisma. No se tocó OpenAPI central ni frontend.
