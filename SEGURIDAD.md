# Seguridad — estado y operación

## Controles observados

Fastify Helmet; CORS configurable (en producción sin origen si no se configura); cookies HTTP-only/same-site; JWT y bcrypt; rate limit global y más estricto en login/registro; bloqueo de intentos; 2FA TOTP opcional; permisos y guards backend; validación de extensión y límites multipart 10 MiB; backup restore limita body a 50 MiB; logs de auditoría.

## Riesgos pendientes

- Compose usa `POSTGRES_PASSWORD=postgres`, `JWT_SECRET=change-me-in-production`, `ADMIN_PASSWORD=admin123` como defaults y no incluye `COOKIE_SECRET`; no desplegar así. Inyectar secretos fuertes/únicos mediante `.env` privado o gestor de secretos.
- Cookie `secure:false` está configurada incluso en producción: requiere revisión antes de exponer sin TLS.
- `db push --accept-data-loss` en Docker es potencialmente destructivo; sustituir por migraciones revisadas en fase posterior.
- `npm audit` backend: 0; frontend: cinco moderadas transitivas (detalles en `REPORTE_PRUEBAS.md`); revisar actualización compatible.
- Cobertura baja; auditorías no prueban autorización exhaustiva, concurrencia ni validación adversarial.

No registrar ni versionar secretos, respaldos reales o uploads. Probar únicamente con cuentas/datos ficticios y base aislada.
