# Seguridad — estado y operación

## Controles observados

Fastify Helmet; CORS configurable (en producción sin origen si no se configura); cookies HTTP-only/same-site; JWT y bcrypt; rate limit global y más estricto en login/registro; bloqueo de intentos; 2FA TOTP opcional; permisos y guards backend; validación de extensión y límites multipart 10 MiB; backup restore limita body a 50 MiB; logs de auditoría.

## Riesgos pendientes

- Compose usa `POSTGRES_PASSWORD=postgres`, `JWT_SECRET=change-me-in-production`, `ADMIN_PASSWORD=admin123` como defaults y no incluye `COOKIE_SECRET`; no desplegar así. Inyectar secretos fuertes/únicos mediante `.env` privado o gestor de secretos.
- Cookie `secure:false` está configurada incluso en producción: requiere revisión antes de exponer sin TLS.
- `db push --accept-data-loss` en Docker es potencialmente destructivo; sustituir por migraciones revisadas en fase posterior.
- `npm audit` backend (post-Playwright): cuatro moderadas en la cadena antigua `drizzle-kit` → `@esbuild-kit` → `esbuild`; `npm audit fix --force` propone downgrade incompatible de drizzle-kit. No aplicar automáticamente; revisar actualización de toolchain. Frontend mantiene cinco moderadas transitivas, documentadas en `REPORTE_PRUEBAS.md`.
- Cookie `secure:false` aún requiere revisión antes de producción con TLS. En CORS no se considera permitido un origen porque envíe `Access-Control-Allow-Credentials`; el navegador también exige `Access-Control-Allow-Origin` coincidente, comprobado en entorno aislado.
- La batería Task 6 aporta checks live de contrato, autenticación, expiración, rate limit, autorización, validación, cabeceras y CORS. Flujos de escritura UI, 2FA UI, backup/restore concurrente y pruebas exhaustivas de roles siguen pendientes (ver informe); no interpretar navegación de pantallas como validación de todas sus operaciones.

No registrar ni versionar secretos, respaldos reales o uploads. Probar únicamente con cuentas/datos ficticios y base aislada.

## Ejecución aislada E2E/seguridad

Instalar Chromium con `npm run test:e2e:install`. Configurar `DATABASE_URL` a una base PostgreSQL descartable ya migrada (`npm run db:migrate`), `PORT=3300`, `JWT_SECRET` y `ADMIN_PASSWORD` ficticios y `CORS_ORIGIN=http://127.0.0.1:55900`. Luego ejecutar `npm run test:e2e` con `E2E_API_URL=http://127.0.0.1:3300`, `E2E_BASE_URL=http://127.0.0.1:55900` y `E2E_ADMIN_PASSWORD` igual a la contraseña sembrada. Para `npm run test:security`, mantener backend aislado levantado y definir además `JWT_SECRET`. Nunca apuntar a la instancia de desarrollo compartida ni usar credenciales reales. Evidencia y límites están en `.superpowers/sdd/2026-11-05-modernizacion-inventario/e2e-security-report.md`.
