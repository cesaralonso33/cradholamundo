# Progreso de migración

## Estado actual

- [x] Inspección inicial del proyecto original.
- [x] Enfoque incremental aprobado.
- [x] Copia independiente creada en `C:\laragon\www\proyecto-modernizado`.
- [x] Dependencias instaladas, `dist`, uploads y secretos excluidos de la copia inicial.
- [x] Rama local `modernizacion` inicializada.
- [x] `ANALISIS_INICIAL.md` creado.
- [x] Diseño técnico creado y pendiente de aprobación para iniciar implementación.
- [x] Línea base ejecutada y documentada en `REPORTE_PRUEBAS.md` (backend build pasa; backend test requiere `DATABASE_URL`; frontend build y tests pasan).
- [x] Esquema Drizzle, cliente tipado, configuración y migración inicial (`Task 2`).
- [ ] Migración de rutas y servicios.
- [ ] Pruebas de integración, seguridad y E2E.
- [ ] Verificación Docker y documentación final.

## Registro de decisiones

2026-11-05 — Se seleccionó migración incremental sobre copia independiente para conservar la semántica existente y evitar tocar el proyecto original.

2026-11-05 — Task 2: `prisma/schema.prisma` prevalece sobre migraciones históricas. Se mapearon sus 13 modelos (aunque el brief menciona 12) conservando los nombres SQL por defecto de Prisma (`Product`, `User`, etc.), los nombres originales de columnas y `DateTime` como `timestamp(3)` sin zona horaria. IDs CUID y `updated_at` se generan/actualizan desde Drizzle en la aplicación; `created_at` y defaults funcionales permanecen SQL cuando así lo define Prisma. La migración inicial solo crea tablas, índices y FKs; no elimina objetos.

2026-11-05 — Task 2: la migración se aplicó desde cero y se probaron unicidad, FK `SetNull`, cascada y transacción de inventario en un PostgreSQL aislado temporal (`pg-task2`, puerto 55432). Docker no está disponible, pero sí PostgreSQL local; no se usaron datos reales. `npm test` pasa con `DATABASE_URL` apuntando a esa base temporal; sin `DATABASE_URL`, el test existente `tests/health.test.ts` falla como en la línea base documentada.
