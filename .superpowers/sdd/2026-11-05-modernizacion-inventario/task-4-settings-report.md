# Task 4 — settings, backup y auditoría

## Alcance

Migración de `src/routes/settings.ts`, `src/routes/backup.ts`, `src/routes/audit.ts` y dependencias directas desde Prisma a Drizzle/repositorios existentes. No se modificaron auth, inventario, empleados/papelería, frontend ni OpenAPI central.

## Cambios

- Configuración mantiene permisos `settings`; la administración de API key (crear, activar, revocar) conserva acceso exclusivo admin.
- Validación Zod en escritura settings, activación API, filtros/paginación de auditoría y contrato básico del backup.
- Auditoría conserva filtros action/username/entityType y paginación con `pageSize` máximo 100 mediante `auditRepository`.
- Backup continúa siendo admin-only. Exportación omite password y TOTP por defecto; solo `GET /api/backup?includeSensitive=true` exporta los campos sensibles. Restore requiere admin y aplica reemplazo en transacción Drizzle.
- `src/lib/settings.ts` ahora carga la caché mediante el repositorio Drizzle.

## Verificación

- `npm run build`: correcto.
- `npm test`: incompleto. 12 tests pasaron, 25 fueron omitidos y suites con PostgreSQL fallaron por no estar configurado `DATABASE_URL`; health además no pudo inicializar Prisma por faltar `prisma generate` en la instalación limpia.
- No fue posible ejecutar pruebas de integración propias sobre PostgreSQL real ni demostrar RED→GREEN/rollback: no hay URL configurada, servicio PostgreSQL local ni Docker en este entorno. Queda pendiente y no se afirma validación de runtime.

## Riesgo pendiente

El restore y la restauración desde backup sin hashes de password deben verificarse con el contrato de recuperación acordado; el backup normal excluye dichos hashes y el campo sigue siendo requerido en la tabla User.
