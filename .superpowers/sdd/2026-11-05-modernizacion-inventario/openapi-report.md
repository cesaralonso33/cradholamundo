# Task 4 — cierre OpenAPI e higiene Prisma

## Contrato API

- Creada la especificación OpenAPI 3.1 en `src/openapi.ts` y su versión YAML versionada en `docs/openapi.yaml`. Incluye todos los endpoints actuales: health, auth/2FA, users/roles/permisos, inventario/productos, empleados/constancias, papelería/pedidos, configuración, backup/auditoría y publicación de la propia especificación.
- Las operaciones describen requisitos de autenticación/permisos, parámetros, cuerpos (JSON o multipart), respuesta de éxito y errores comunes `400/401/403/404/409/413/429/500`. Se registran `GET /api/openapi.yaml` y `GET /api/openapi.json`; el manual ApiDocs enlaza ambos formatos.
- `tests/openapi.test.ts` contrasta cada ruta Fastify declarada con el conjunto de operaciones documentadas, verifica cuerpos/campos y análisis del artefacto YAML como JSON (subconjunto válido de YAML). `tests/integration/runtime.test.ts` verifica estado, Content-Type y equivalencia en ambos endpoints servidos.

## Higiene Prisma

- Inspección de consumidores permitió retirar `src/lib/prisma.ts`, `@prisma/client`, `prisma`, `db:push` y `db:studio`. `scripts/perf-seed.mjs` también dejó de depender de Prisma (usa PostgreSQL `pg`), lo que hizo posible retirar ambas dependencias.
- Se preservan `prisma/schema.prisma` y el historial de migración/documentos históricos. README, arquitectura, despliegue y guía Docker describen Drizzle. Docker ejecuta migraciones versionadas con `drizzle-kit migrate`, no `db push` destructivo.

## RED → GREEN y verificación

- RED: `npx vitest run tests/openapi.test.ts` no pudo importar `src/openapi.js` antes de implementar el contrato.
- GREEN: `npx vitest run tests/openapi.test.ts`: 3/3.
- PostgreSQL aislado local `inventory_task4`, puerto 55434 (sin datos reales): `npm run build` correcto; `npm test` completo 13 archivos / 58 tests aprobados, incluida integración runtime con endpoint OpenAPI.
- `node --check scripts/perf-seed.mjs`: correcto. El seed no se ejecutó para evitar crear registros de rendimiento en la base compartida.
- Docker no está disponible para verificación de contenedor. Queda anotado como limitación, no como prueba pasada.
