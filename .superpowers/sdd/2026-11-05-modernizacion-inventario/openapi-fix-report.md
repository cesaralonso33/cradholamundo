# Informe del fix OpenAPI

Fecha: 2026-11-05  
Commit base: `48a06e9`  
Alcance: especificación y pruebas; ninguna modificación de lógica HTTP.

## Hallazgos abordados

1. Se sustituyó la seguridad global por requisitos a nivel operación. El token de 2FA es separado del JWT regular y las rutas públicas quedan sin requisitos de auth. Se anotan restricciones en `xAccess` (admin/permiso/público/autenticado) además de la descripción.
2. Se eliminaron los errores genéricos universales. Las respuestas 400/401/403/404/409/413 solo se agregan en operaciones donde el tipo de handler/entrada/ACL las hace pertinentes; health conserva su 503 conocido. Las respuestas de éxito permanecen documentadas.
3. Se añadieron pruebas para auth, límites admin/permiso, cuerpos/parámetros y respuestas, junto con la comparación exhaustiva de rutas declaradas y documentadas. Los endpoints JSON/YAML y ApiDocs permanecen.

## Evidencia

- RED: pruebas OpenAPI fallaron antes del cambio por la seguridad mixta universal y respuestas auth en operaciones públicas.
- GREEN: pruebas OpenAPI 6/6.
- Build backend: `npm run build` correcto.
- Build frontend: `npm ci && npm run build` correcto.
- Suite backend: `DATABASE_URL=postgresql://postgres@localhost:5432/postgres npm test`, 13 archivos y 61 pruebas correctas. Las pruebas runtime/integración preparan bases temporales aisladas.
- Docker: no disponible; no verificado.

Trabajo aislado en worktree; la copia original no fue modificada.
