# Task 3 — Repositorios y servicios

## Implementado

- `src/db/repositories/index.ts`: repositorios tipados Drizzle para productos, movimientos, usuarios, roles, empleados/constancias, papelería/pedidos, auditoría, settings y exportación de backup.
- `src/services/`: servicios para productos, inventario, pedidos de papelería, usuarios/roles/empleados, auditoría, settings y backup.
- `src/lib/validation.ts` centraliza parseo Zod; `src/lib/errors.ts` traduce conflictos/constricciones/validación a errores HTTP sin exponer mensaje interno, secretos ni stack.
- Movimiento registra producto y movimiento en una transacción. La salida de inventario usa un `UPDATE` condicional atómico evitando cantidad negativa con solicitudes concurrentes. El cierre vuelve a comprobar estado OPEN dentro de la transacción y actualiza con condición por estado.
- Conservadas búsqueda parcial case-insensitive, scope por ubicación, límites de página y orden `updated_at DESC` de productos; para auditoría filtros existentes, orden `created_at DESC` y paginación; para catálogos/pedidos orden por fecha descendente.

## Pruebas

- TDD RED: `npx vitest run tests/services` falló inicialmente porque los servicios/reglas no existían. Tras implementar, el primer GREEN descubrió que la validación de tipo no aceptaba minúsculas; se corrigió y pasó.
- `npx vitest run tests/services`: 3 archivos, 7 tests pasan.
- Revisión posterior: `backupRepository.exportAll()` excluye `password` y `totp_secret` por defecto; el modo administrativo tipado `includeSensitiveUserData: true` conserva ambos campos para respaldos restaurables. Test PostgreSQL verifica los dos modos usando valores sintéticos.
- `closeOrder` devuelve conflicto explícito (`CONFLICT`, HTTP 409) si el pedido ya no está OPEN o el UPDATE condicional pierde una carrera. Test PostgreSQL comprueba el cierre y el reintento conflictivo.
- Tests de integración PostgreSQL para `recordMovement`: confirma saldo y movimiento al confirmar, y que una salida insuficiente no deja movimiento parcial.
- RED observado: el test de exportación detectó que el modo seguro aún devolvía `password`. Tras corregirlo pasan las pruebas. Los tests de servicios Drizzle contra PostgreSQL se ejecutaron sobre la base descartable creada por la suite de migraciones.
- `npx vitest run tests/db/migrations.test.ts`: 7 tests pasan; `npm run build`: pasa.
- `npm test`: 19/20 pasan; `tests/health.test.ts` falla porque la base configurada no tiene las tablas Prisma esperadas por `seedPapeleria`. Las pruebas nuevas de Task 3 y migración sí pasan en su base descartable aislada.
- `npm run build`: pasa (TypeScript estricto).
- `tests/db/migrations.test.ts` contra PostgreSQL local: la suite crea y elimina una base aleatoria aislada; no accede a tablas/datos de la base indicada como admin.

## Alcance y bloqueos conocidos

- Las rutas permanecen en Prisma deliberadamente: este task entrega interfaces/capa nueva, no migra rutas completas.
- No se añadieron pruebas de integración de las rutas, que siguen en Prisma deliberadamente. Los servicios Drizzle de inventario/cierre sí cuentan ahora con pruebas PostgreSQL sobre una base descartable.
- `backupRepository` implementa exportación; la restauración transaccional existente continúa en la ruta Prisma hasta una tarea de migración posterior.
- No hay bloqueos de compilación. La suite completa conserva un fallo conocido en health test debido a ausencia de tablas Prisma en la base configurada; ver resultado de `npm test` arriba.
