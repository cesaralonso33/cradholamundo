# OpenAPI review fix report

## Cambios

- Se conserva OpenAPI 3.1, las rutas JSON/YAML y el enlace existente de ApiDocs.
- La seguridad se documenta por operación: rutas públicas sin auth ni errores 401/403; operaciones protegidas describen JWT/cookie y `x-api-key` (el middleware `authenticate` admite las tres). El login con 2FA retorna `tempToken` en el cuerpo y no usa `tokenType` ni un esquema de seguridad temporal en Authorization; ese token se envía en el cuerpo de completar 2FA.
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

## Corrección de hallazgos en `f885925`

- Registro documentado con Bearer JWT, cookie `token` o `x-api-key` y respuestas 401/403; completar 2FA recibe `tempToken` y `code` requeridos en JSON, sin esquema de seguridad Authorization.
- Login documenta el bloqueo 429, su cuerpo y `Retry-After`.
- OpenAPI ahora asigna estructuras de éxito según familia de operación; tests comprueban acceso, tempToken, 429 y que los éxitos no sean objetos genéricos sin forma.
- RED observado en tests de contrato tras agregar assertions; `npm test -- tests/openapi.test.ts` (6/6) y builds backend/frontend pasan.
- Suite completa intentada sin `DATABASE_URL`: 18 tests pasan y los tests DB/integración no pueden ejecutarse por falta del servidor PostgreSQL requerido. No afirmar verificación PostgreSQL aislada.

## Corrección de formas de éxito de autenticación

- `POST /api/auth/login` especifica dos ramas: `{token,user}` en login normal y `{requires2fa:true,tempToken,user}` en login pendiente de 2FA. Se describen los campos reales del usuario en cada rama.
- `GET /api/auth/me` describe `id`, `username`, `role`, `permissions`, `two_factor_enabled` y `email` opcional; se elimina el objeto genérico `{id,message}`.
- Tests de contrato validan explícitamente ambas ramas y campos; RED confirmado antes de actualizar el schema OpenAPI y `docs/openapi.yaml`.
- No se modificó lógica HTTP.
- Verificación de esta corrección: `npm test -- tests/openapi.test.ts` 7/7; `npm run build` backend; `npm --prefix frontend run build`; suite completa con `DATABASE_URL=postgresql://postgres@localhost:5432/postgres` 13 archivos / 62 tests. Docker no está disponible en PATH.
