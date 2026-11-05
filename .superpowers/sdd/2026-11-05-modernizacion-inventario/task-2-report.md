# Informe Task 2 — esquema Drizzle y migraciones aisladas

## Implementado

- `src/db/schema.ts`: entidades Drizzle tipadas para los 13 modelos de `prisma/schema.prisma`, índices, únicos, arrays, defaults y políticas de borrado. Incluye generador CUID compatible con la forma (25 caracteres) de los IDs del esquema, `$onUpdate` y tipos inferidos; `createProductSchema` valida defaults de inserción con Zod.
- `src/db/client.ts`: cliente Drizzle tipado sobre `pg`, compartido en desarrollo.
- `drizzle.config.ts`, `drizzle/0000_initial.sql` y metadata versionada; comandos `db:generate`, `db:migrate` y `db:check`.
- Dependencias añadidas: `drizzle-orm`, `pg`, `zod`, `drizzle-kit`, `@types/pg`.
- Pruebas `tests/db/schema.test.ts` y `tests/db/migrations.test.ts`.

## Decisiones de correspondencia

La fuente autoritativa fue `prisma/schema.prisma`; las migraciones históricas no se utilizaron como contrato. Se conservaron los nombres de tabla PostgreSQL por defecto de Prisma (`Product`, `InventoryMovement`, etc.) porque el esquema no declara `@@map`; las columnas preservan sus identificadores declarados. Prisma PostgreSQL `DateTime` se representa como `timestamp(3) without time zone`. `created_at`/`last_attempt` mantienen `now()` SQL; Prisma `cuid()` y `@updatedAt` no son defaults SQL, por lo que se generan/actualizan desde Drizzle. El brief enumera doce entidades, pero el esquema contiene trece modelos y se implementaron los trece.

## Verificación

- RED observado: ambas nuevas suites fallaron inicialmente por ausencia del esquema y la migración.
- `npm run db:generate`: generó 13 tablas, 24 índices, 7 claves foráneas.
- `npm run db:check`: correcto.
- Migración aplicada desde cero en PostgreSQL temporal iniciado con `initdb` (DB `task2`, `127.0.0.1:55432`); no se usaron datos reales. Comprobación SQL transaccional con rollback verificó índices únicos, FK, `SetNull`, cascada y actualización de inventario; todo correcto.
- `npm run build`: correcto.
- `npm test` sin `DATABASE_URL`: falla el test preexistente `tests/health.test.ts` al inicializar Prisma por variable de entorno ausente (igual requisito registrado en reporte base). Con `DATABASE_URL=postgresql://postgres@127.0.0.1:55432/task2`: 3 archivos y 6 pruebas pasan.
- Docker no está instalado; el PostgreSQL aislado local permitió completar la validación solicitada.
- No se modificaron rutas ni servicios. No se modificó el proyecto original.

## Alcance pendiente

La base temporal quedó fuera del repositorio en `C:\Users\crad\AppData\Local\Temp\opencode\pg-task2` y el servidor ya está detenido. Continuar rutas en la siguiente tarea.
