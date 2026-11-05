# Informe E2E y seguridad

## Ejecución Task 6 (2026-11-05)

Entorno desechable PostgreSQL 14 inicializado desde cero con `initdb` en `%LOCALAPPDATA%\Temp\opencode\task6-pg`, DB `inventory_task6`, puerto 55436. Se ejecutó `npm run db:migrate`; backend/API en 3336 (y una instancia de comprobación de seguridad en 3340), frontend/proxy Playwright en 55936. No se usaron Docker (no está instalado), puertos 3000 ni el servicio de origen; secretos se pasaron como variables de proceso, no se escribieron en el repositorio.

### Aprobado

- `npm run test:e2e`: 3/3 en Chromium con backend, proxy y DB reales. Incluye login admin válido, alta de producto por API para fixture, movimiento IN por formulario UI y comprobación de stock persistido por GET; navegación autenticada de inventario/papelería/empleados/settings, login inválido y redirecciones anónimas.
- El primer intento E2E falló por selector ambiguo (`getByLabel("Producto")` también coincidía con la búsqueda); se cambió a etiqueta exacta y el rerun quedó verde. Cambio solo en `tests/e2e/main-flows.spec.ts`.
- Backend `npm test`: 62 passed, 6 skipped (integración dependiente de DB/config). Backend build y frontend build correctos. Frontend: 19/19 tests.
- Checks live de contrato/headers, auth requerida, malformed login y CORS denegado pasaron en las ejecuciones de seguridad.

### Parcial / bloqueos (no aprobado)

- Security suite no terminó verde y reproducible: con una ejecución mezclada la cuenta admin quedó bajo lockout por intentos de login E2E compartiendo DB; al volver a correr sobre el mismo estado, login/Retry-After devolvieron 500 por ese estado de intentos. La suite aislada inicial observó Retry-After, pero expiración/cookie fue 429. No se declara aprobada la suite completa. Hace falta DB fresh dedicada por suite y ejecutar sin tests E2E previos; los tests comparten IP/estado de LoginAttempt.
- Login y navegación sí se probaron, pero no se configuró y validó TOTP; no se declara 2FA aprobado.
- No se implementó/ejecutó E2E UI de usuario limitado, pedidos abrir/cerrar, constancia con archivo permitido, exportación segura ni restore sensible/rollback; no se ejecutó concurrencia backup/restore. Estos flujos quedan pendientes, no aprobados. Infra DB/puertos sí estaba disponible: son faltas de cobertura/fixture, no bloqueos externos.

## Resultado y alcance

Task 6 está **parcial**: el movimiento desde UI y stock persistido sí se comprobaron realmente, pero la batería solicitada no está completa. Para cerrar pendientes, añadir fixtures UI para usuario limitado/empleado y pedido, aislar security en DB nueva (y limpiar `LoginAttempt` solo en esa DB entre casos), y diseñar aserciones de backup sensible/seguro, rollback y concurrencia sin datos compartidos.

## Reejecución de auth (2026-11-05)

## Controles de descarga sensible (2026-11-05)

- Settings conserva el backup seguro y ahora restringe el backup completo sensible a admins, con confirmación previa que advierte explícitamente sobre contraseñas y secretos TOTP; la solicitud usa `includeSensitive=true`. Tests de componente comprueban visibilidad/no-admin, confirmación y preservación del modo seguro, además del parámetro API.
- Esta cobertura es de frontend y contrato de URL; no constituye validación E2E de autorización/respuesta/restore en backend. Esa validación integral continúa pendiente, según el alcance parcial indicado arriba. No se modificó backend/original.

- `playwright.config.ts` pasa `ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD` al backend de Playwright. Para las pruebas auth basta definir `E2E_ADMIN_PASSWORD`; no se versiona ningún valor secreto. `.env.example` deja `ADMIN_PASSWORD` vacío.
- Se agregó diagnóstico no tolerante al fallo para creación de roles (status y body), y la reproducción confirmó que `POST /api/roles` responde 401 `{"error":"missing token"}`. Las pruebas de auth aún no están aprobadas.
- Cluster PostgreSQL 14 nuevo en `%LOCALAPPDATA%\Temp\opencode\task6-auth-final`, puerto 55839, DB `task6auth`; `npm run db:migrate` pasó. Sin Docker.
- E2E dirigida (2FA real y cuenta limitada): 0/2. El primer rerun reprodujo extractor TOTP incorrecto (selector `code` genérico leía texto de la página con `:`); se acotó al `<code>` junto a «Clave manual». El segundo rerun no encontró el campo de verificación y el rol siguió dando 401 missing token aun usando fetch del navegador. Sin atribuir causa backend ni modificarlo.
- Verificaciones en DB aislada: build backend pasó; `npm test` pasó (62, 6 omitidas); `npm run test:db` pasó (12); frontend build pasó. `npm run test:security` se ejecutó sin `E2E_API_URL`, por lo que sus 6 pruebas live se omitieron: no acredita seguridad live.
- Rerun live de seguridad contra backend aislado en puerto 3342: 5/6 pasan, falla CORS porque la respuesta refleja `https://untrusted.invalid` en `Access-Control-Allow-Origin`; no se alteró backend ni se declara suite aprobada.
