# OpenAPI review fix report

## Cambios

- Se conserva OpenAPI 3.1, las rutas JSON/YAML y el enlace existente de ApiDocs.
- La seguridad se documenta por operación: rutas públicas sin auth ni errores 401/403; operaciones protegidas describen JWT/cookie y `x-api-key` (el middleware `authenticate` admite las tres); el flujo de completar 2FA usa metadata `tokenType: temporary-2fa` y un esquema separado.
- Cada operación expone `xAccess` estructurado (`public`, `authenticated`, `permission` o `admin`); la descripción conserva la explicación legible de la regla.
- Las respuestas de error se limitan a condiciones aplicables por ruta (acceso, parámetros/recurso, entrada, conflicto, carga grande y health 503), en vez del conjunto universal anterior. Se mantienen respuestas de éxito y schemas de error.
- Los tests comprueban cobertura de rutas Fastify, YAML/JSON, seguridad, permiso/admin, parámetros, cuerpos y códigos de respuesta recorriendo operaciones y metadata.

## Verificación

- RED: el test ampliado falló primero por seguridad generalizada y errores auth en health/OpenAPI.
- GREEN: `npm test -- tests/openapi.test.ts` — 6/6.
- `npm run build` backend — correcto.
- `frontend`: `npm ci` y `npm run build` — correcto.
- `DATABASE_URL=postgresql://postgres@localhost:5432/postgres npm test` — 13 archivos, 61/61; los tests de integración crean y eliminan sus propias bases temporales PostgreSQL.
- Docker no está instalado/disponible; no se verificó Docker, según lo documentado.

## Alcance

No se modificó lógica HTTP. Cambios hechos en worktree independiente basado en `48a06e9`; la copia original permanece intacta.
