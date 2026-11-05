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
- [x] Task 3: capa inicial tipada de repositorios Drizzle y servicios; reglas de movimientos/cierre, errores y validación centralizados. Migración de rutas sigue pendiente.
- [x] Task 4 (auth/administración): rutas auth, users y roles en Drizzle; utilidades compartidas de autenticación, permisos, auditoría e intentos de login migradas; tests de integración con PostgreSQL aislado.
- [x] Task 4 (inventario): productos, historial, archivo y movimientos migrados a Drizzle con Zod, errores centralizados y pruebas HTTP de integración contra PostgreSQL aislado; validada la concurrencia de salidas sin permitir stock negativo.
- [ ] Pruebas de integración, seguridad y E2E.
- [ ] Verificación Docker y documentación final.

## Registro de decisiones

2026-11-05 — Se seleccionó migración incremental sobre copia independiente para conservar la semántica existente y evitar tocar el proyecto original.

2026-11-05 — Task 2: `prisma/schema.prisma` prevalece sobre migraciones históricas. Se mapearon sus 13 modelos (aunque el brief menciona 12) conservando los nombres SQL por defecto de Prisma (`Product`, `User`, etc.), los nombres originales de columnas y `DateTime` como `timestamp(3)` sin zona horaria. IDs CUID y `updated_at` se generan/actualizan desde Drizzle en la aplicación; `created_at` y defaults funcionales permanecen SQL cuando así lo define Prisma. La migración inicial solo crea tablas, índices y FKs; no elimina objetos.

2026-11-05 — Task 2: la migración se aplicó desde cero y se probaron unicidad, FK `SetNull`, cascada y transacción de inventario en un PostgreSQL aislado temporal (`pg-task2`, puerto 55432). Docker no está disponible, pero sí PostgreSQL local; no se usaron datos reales. `npm test` pasa con `DATABASE_URL` apuntando a esa base temporal; sin `DATABASE_URL`, el test existente `tests/health.test.ts` falla como en la línea base documentada.

2026-11-05 — Task 3: se agregaron repositorios tipados para productos, movimientos, usuarios, roles, empleados/constancias, papelería/pedidos, auditoría, settings y backup, con filtros/paginación de productos y auditoría y órdenes descendentes preservadas. Movimientos y cierre de pedido encapsulan transacciones; la salida de inventario se actualiza con condición SQL atómica que evita saldo negativo concurrente. Servicios críticos validan entradas con Zod. En ese punto las rutas aún usaban Prisma; las rutas de inventario migraron en Task 4. Informe: `.superpowers/sdd/2026-11-05-modernizacion-inventario/task-3-report.md`.

2026-11-05 — Task 4 inventario: `src/routes/products.ts` usa Drizzle repositorios/servicio para crear, editar, listar, obtener, archivar, eliminar productos y registrar movimientos; Zod valida parámetros, consultas y cuerpos; historial de ubicaciones ahora tiene listado paginado desde repositorio. Conservadas respuestas legacy para campos requeridos, duplicados, faltantes, movimiento inválido/sin stock y permisos. Pruebas HTTP RED→GREEN ejecutadas con PostgreSQL local desechable temporal fuera del repo (puerto 55434, base `inventory_task4`); `npx drizzle-kit migrate`, pruebas específicas (3/3), `npm run build` y suite completa `npm test` (33/33) pasan. La prueba de salidas concurrentes confirma que una de dos salidas concurrentes se rechaza, cantidad final 1 y un solo movimiento/auditoría. Informe: `.superpowers/sdd/2026-11-05-modernizacion-inventario/task-4-inventory-report.md`.

- [x] Task 4 (empleados/papelería): rutas de empleados, constancias, artículos y pedidos migradas a Drizzle; validaciones Zod, errores centralizados, cierre transaccional/condicional y pruebas HTTP en PostgreSQL aislado.
- [x] Task 4 (settings/backup/auditoría): rutas trasladadas a Drizzle con validación Zod; exportación segura sin password/TOTP y restore completo solo desde backup sensible explícito, admin-only. Cobertura HTTP/DB real en PostgreSQL temporal aislado.
- [x] Task 4 (runtime central): `src/app.ts` y `src/index.ts` arrancan con Drizzle; health ejecuta `SELECT 1`, seeds iniciales usan esquema/repositorios Drizzle, limpieza periódica de intentos de login usa repositorio y shutdown cierra Fastify y el pool PostgreSQL. Plugins, seguridad, rate limit, multipart, uploads y registro de rutas preservados. Prueba runtime usa PostgreSQL aislado y migraciones Drizzle.

2026-11-05 - Task 4 empleados/papelería: `src/routes/employees.ts` y `src/routes/papeleria.ts` usan Drizzle/repositorios existentes, preservan permisos por endpoint, importación de Excel, multipart, listados/respuestas y reglas de pedidos. Entradas con Zod y mapping central de errores; cierre vía servicio transaccional y actualización condicional. No cambia la regla de stock: cerrar pedido no altera cantidades de catálogo. Integración HTTP en PostgreSQL local aislado (`people_paper_base`, puerto 55434) aprobada (3/3), incluyendo permisos, rechazos de multipart inválido, propiedad del pedido, folio, cierre concurrente (un solo cierre), rollback de reemplazo inválido y cantidad inalterada. Build y suite: 41/41. Informe: `.superpowers/sdd/2026-11-05-modernizacion-inventario/task-4-people-paper-report.md`.

2026-11-05 - Task 4 settings/backup/auditoría: semántica del backup explícita: export seguro omite password/TOTP, lleva marcador `includes_sensitive_user_data=false` y restore lo rechaza con mensaje de recuperación; únicamente export admin `?includeSensitive=true` incluye campos y es restaurable, y el restore exige marcador y credenciales, siempre admin-only y transaccional. Restore y `backup.restored` se confirman en una transacción única; exportación y `backup.exported` también se confirman atómicamente, y el evento registra únicamente el booleano de modo sensible. PostgreSQL 14 temporal aislado (`initdb`, puerto 55439): RED observado en trigger PostgreSQL que rechaza auditoría de restore (la ruta respondía éxito pese al fallo); GREEN prueba rollback de datos y fallo sin entregar export cuando falla auditoría. Suite HTTP/DB: 4/4; build y suite completa 49/49 pasan. Informe: `.superpowers/sdd/2026-11-05-modernizacion-inventario/task-4-settings-report.md`.

2026-11-05 - Task 4 runtime central: eliminadas referencias Prisma de app/index; seed de admin/roles/papelería, health real y barrido de `LoginAttempt` usan Drizzle; pool PostgreSQL finaliza con shutdown. `tests/integration/runtime.test.ts` crea base efímera, ejecuta las migraciones y valida health en ambas rutas, seeds y cierre de Fastify. Verificado build y prueba runtime (4/4) contra PostgreSQL local. Informe: `.superpowers/sdd/2026-11-05-modernizacion-inventario/runtime-report.md`.
