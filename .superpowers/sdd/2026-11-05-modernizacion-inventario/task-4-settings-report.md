# Task 4 — settings, backup y auditoría

## Semántica de backup y restauración

- `GET /api/backup` (admin) produce una exportación segura: los registros de usuarios no incluyen `password` ni `totp_secret`. La metadata marca `includes_sensitive_user_data: false`.
- El backup seguro **no se puede restaurar completo**: `POST /api/backup/restore` lo rechaza antes de tocar la base y responde `400` con el mensaje `backup excludes password and TOTP; export with includeSensitive=true to restore`.
- Solo `GET /api/backup?includeSensitive=true` (admin) incluye esos campos y marca la exportación como sensible. El restore completo exige ese marcador y que cada usuario incluya password y TOTP (el TOTP puede ser `null`). Restore permanece admin-only y se ejecuta dentro de una transacción Drizzle.
- Los payloads y datos de producto se validan con Zod; un error de validación/database durante el reemplazo revierte la transacción.

## Pruebas y verificación

Se añadió `tests/integration/backup-security.test.ts`, que crea y elimina una base desechable y prueba las rutas HTTP reales:

1. Export seguro no expone `password`/`totp_secret`; export sensible sí los incluye.
2. Restore de backup sensible válido recupera datos y credenciales.
3. Backup seguro recibe rechazo explícito sin borrar usuarios.
4. Payload inválido produce `400` y se verifica que el estado previo permanezca (rollback).
5. Un usuario no admin recibe `403` en export y restore.

RED: inicialmente la prueba HTTP falló en 2 casos (restore sensible `500`, backup seguro no se rechazaba) y pasó 1. GREEN: después de la corrección, 3/3 pruebas de integración pasan.

PostgreSQL 14 local temporal, inicializado con `initdb` fuera del repo, puerto `55439`; las pruebas crean sus propias bases aisladas y las eliminan. `npm run build` pasa. `npm test` pasa completo: 11 archivos, 48 tests.

## Alcance preservado

Cambios limitados a backup, su repositorio directo, pruebas y documentos de Task 4. No se tocaron auth, inventario, empleados/papelería, frontend ni OpenAPI central.
