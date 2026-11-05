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
- `npm run build`: pasa (TypeScript estricto).
- `tests/db/migrations.test.ts` contra PostgreSQL local con URL `postgresql://crad@localhost:5432/postgres`: 4 tests pasan, incluyendo transacción/constraints dentro de base descartable creada por la suite. No se accedió a tablas/datos de la base indicada como admin; la suite creó y eliminó una base aleatoria aislada.

## Alcance y bloqueos conocidos

- Las rutas permanecen en Prisma deliberadamente: este task entrega interfaces/capa nueva, no migra rutas completas.
- No se añadió prueba automatizada de integración que invoque los servicios Drizzle sobre PostgreSQL; los tests de reglas son unitarios puros y el test real ejecutado cubrió migración y constraints. La cobertura end-to-end de movimiento/cierre queda pendiente antes de cambiar rutas.
- `backupRepository` implementa exportación; la restauración transaccional existente continúa en la ruta Prisma hasta una tarea de migración posterior.
- No hay bloqueos de compilación ni de las pruebas ejecutadas. La suite completa no se ejecutó porque health test requiere configuración DATABASE_URL de aplicación.
