# Task 6 — E2E y seguridad

Fecha: 2026-11-05. Cambios limitados a configuración de pruebas, proxy de desarrollo configurable y documentación. No se modificó lógica backend/frontend.

## Evidencia local

- `npm run build` (backend): pasa.
- `npm audit --audit-level=moderate`: falla intencionalmente con 4 vulnerabilidades moderadas transitivas de `drizzle-kit` → `@esbuild-kit` → `esbuild`; el único fix propuesto por npm es downgrade incompatible de drizzle-kit. Sin cambios automáticos.
- `npm test` ejecutado contra `inventory_task6_clean` con `E2E_API_URL` ausente: 62 pasaron, 6 live security checks omitidos (13 files passed, 1 skipped). Los checks live requieren URL explícita y no prueban un destino implícito.
- `npx playwright test` con backend/cliente reales: 3/3 aprobados, Chromium. Primero se observó RED: Playwright no encontraba input por `getByLabel` ya que el control no enlaza el `<label>`; corregido el selector por tipo de input (solo test). GREEN: login admin, rechazo de password inválido, acceso a pantallas `/`, `/papeleria`, `/employees`, `/settings`, y redirección a login sin sesión. El recorrido no envía movimientos, pedidos, constancias ni restores; no prueba aún flujo 2FA ni denegación de cada enlace según rol.
- `npx vitest run tests/security` contra API aislada/DB nueva `inventory_task6_clean`: 6/6 aprobados (contrato+headers, authz, Zod malformado, cookie HttpOnly y JWT expirado, Retry-After/lockout, CORS). Inicialmente una assertion rechazaba `Access-Control-Allow-Credentials` por sí solo; se corrigió para comprobar que no se refleje `Access-Control-Allow-Origin` para el origen hostil. Una repetición posterior de E2E fue bloqueada por Retry-After porque security ya había acumulado intentos desde la misma IP; por eso E2E y security deben correrse sobre DBs nuevas y separadas.

## Evidencia PostgreSQL aislado

- PostgreSQL 14 temporal ya existente en `127.0.0.1:55434`; se creó `inventory_task6`, se aplicaron migraciones Drizzle, y se usó el admin ficticio `Task6_Isolated_Admin_2026!` (no versionado).
- Backend levantado en 3300 y frontend en 55900, CORS limitado a `http://127.0.0.1:55900`. Chromium cargó la UI y consultó API; no se hicieron cambios en el servicio original.
- Antes de reconfigurar aislamiento, se descubrió que el puerto 3000 pertenecía a `C:\laragon\www\inventario` (checkout original). Se detuvo su uso como destino; no se editaron ni reiniciaron procesos de ese checkout. Se configuró `API_PROXY_TARGET` para Vite y puertos independientes de Playwright.

## No ejecutado / bloqueos

- Interacción completa UI para registrar y revisar movimiento, crear/cerrar pedido, emitir constancia y hacer export/restore de backup.
- 2FA real (setup, TOTP y completar login), cookie en navegador tras login 2FA y expiración temporal de 2FA.
- Autorización exhaustiva con usuario limitado y navegación oculta/denegada endpoint por endpoint.
- Operaciones adversariales adicionales de Zod/body size, `Retry-After` global independiente del lockout de credenciales, concurrencia de backup/restore y concurrencia específica durante E2E. La concurrencia de salida de stock y cierre de pedido cuenta con evidencia de integración previa en los informes Task 4, no se repitió aquí.
- Auditoría frontend detallada: la línea base reporta cinco moderadas transitivas; no se aplicó `npm audit fix --force`.
- Suite conjunta de operaciones UI y base de datos recién creada, junto con pruebas específicas de 2FA y restauración concurrente. Debido a eso Task 6 queda parcial, no debe marcarse como seguridad/E2E integral aprobada.

## Reproducción

Con PostgreSQL descartable levantado y migraciones aplicadas, usar valores ficticios y puertos disponibles:

```powershell
$env:DATABASE_URL='postgresql://postgres:<password>@127.0.0.1:<port>/<fresh_database>'
$env:JWT_SECRET='<random-secret-at-least-32-chars>'
$env:ADMIN_PASSWORD='<isolated-admin-password>'
$env:CORS_ORIGIN='http://127.0.0.1:55900'
$env:PORT='3300'
$env:E2E_API_URL='http://127.0.0.1:3300'
$env:E2E_BASE_URL='http://127.0.0.1:55900'
$env:E2E_ADMIN_PASSWORD=$env:ADMIN_PASSWORD
npm run db:migrate
npm run test:e2e:install
npm run test:e2e
# Para la suite live de seguridad, mantener backend en ejecución y ejecutar:
npm run test:security
```

La suite security omite por defecto pruebas live si falta `E2E_API_URL`; esto previene accidentalmente pegarle a `localhost:3000` del proyecto original. Reiniciar desde DB nueva para que lockouts previos no invaliden la prueba de rate limit.
