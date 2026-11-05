# Seguridad — estado y operación

## Controles observados

Fastify Helmet; CORS configurable (en producción sin origen si no se configura); cookies HTTP-only/same-site; JWT y bcrypt; rate limit global y más estricto en login/registro; bloqueo de intentos; 2FA TOTP opcional; permisos y guards backend; validación de extensión y límites multipart 10 MiB; backup restore limita body a 50 MiB; logs de auditoría.

## Riesgos pendientes

- Compose usa `POSTGRES_PASSWORD=postgres`, `JWT_SECRET=change-me-in-production`, `ADMIN_PASSWORD=admin123` como defaults y no incluye `COOKIE_SECRET`; no desplegar así. Inyectar secretos fuertes/únicos mediante `.env` privado o gestor de secretos.
- Cookie `secure:false` está configurada incluso en producción: requiere revisión antes de exponer sin TLS.
- `db push --accept-data-loss` en Docker es potencialmente destructivo; sustituir por migraciones revisadas en fase posterior.
- `npm audit` backend (post-Playwright): cuatro moderadas en la cadena antigua `drizzle-kit` → `@esbuild-kit` → `esbuild`; `npm audit fix --force` propone downgrade incompatible de drizzle-kit. No aplicar automáticamente; revisar actualización de toolchain. Frontend mantiene cinco moderadas transitivas, documentadas en `REPORTE_PRUEBAS.md`.
- Cookie `secure:false` aún requiere revisión antes de producción con TLS. En CORS no se considera permitido un origen porque envíe `Access-Control-Allow-Credentials`; el navegador también exige `Access-Control-Allow-Origin` coincidente, comprobado en entorno aislado.
- Task 6 quedó parcial: E2E real valida movimiento por UI y stock, login/navegación, pero no 2FA, usuario limitado, pedido, constancia ni export/restore. La suite live detectó contaminación de estado de login entre ejecuciones y no terminó verde; no asumir seguridad aprobada integralmente. Ver `e2e-security-report.md`.

No registrar ni versionar secretos, respaldos reales o uploads. Probar únicamente con cuentas/datos ficticios y base aislada.

## Ejecución aislada E2E/seguridad

En la ejecución Task 6 se usó PostgreSQL desechable puerto 55436, backend 3336/3340 y frontend 55936; los secretos se inyectaron como variables temporales de proceso. Para reproducir, usar puertos alternativos libres, base recién inicializada y migrada, y separar ejecuciones E2E/security para evitar lockout cruzado. No usar una DB compartida ni credenciales reales. Evidencia y límites en `e2e-security-report.md`.

La continuación auth del 2026-11-05 creó `task6_auth_e2e_20261105` y ejecutó Playwright contra API 3337/frontend 55937. Ambos casos nuevos (2FA y cuenta limitada) fallaron: extracción/generación del TOTP produjo clave inválida y la creación del rol limitado no fue exitosa. LoginAttempt no quedó aislado entre pruebas. No declarar aprobados 2FA, navegación/denegación limitada ni la suite de seguridad. Ver `.superpowers/sdd/2026-11-05-modernizacion-inventario/task-6-auth-e2e-report.md`.
