# Task 6 — autenticación E2E (2026-11-05)

## Alcance y entorno

Se añadieron casos Playwright de navegador real para enrolar 2FA en Settings, iniciar sesión mediante el reto de segundo factor, comprobar el uso de cookie HttpOnly y desactivar 2FA; y para crear un rol/cuenta limitada y verificar redirecciones y denegación de API. No se cambió backend ni se usaron mocks. Se creó la base nueva `task6_auth_e2e_20261105` en el PostgreSQL local (puerto 5432), se aplicaron migraciones y Playwright usó API 3337 y frontend 55937 (ninguno es 3000).

## Resultado observado

### Reintento con PostgreSQL temporal (2026-11-05)

- Se creó un cluster nuevo fuera del repo en `%LOCALAPPDATA%\Temp\opencode\task6-auth-try`, base `task6auth`, puerto PostgreSQL 55828. Migraciones Drizzle aplicadas antes de levantar servicios. Se exportaron `DATABASE_URL`, `JWT_SECRET` (40 caracteres), `ADMIN_PASSWORD`, `E2E_API_URL` (3338), `E2E_BASE_URL` (55938) y `E2E_ADMIN_PASSWORD`; no se usó el puerto 3000.
- Suite dirigida rerun: 2/2 fallidos. 2FA falla antes del enrolamiento porque el primer login no sale de `/login`; por ello en este intento no se observó el DOM ni el valor exacto bajo «Clave manual» y no se puede concluir que la clave o generación TOTP sean el bug.
- El caso de cuenta limitada también falla en `expect(role.ok())`; el test no imprime status/body, así que el status y cuerpo exactos de POST `/api/roles` no se capturaron y su causa sigue sin establecerse.
- Diagnóstico de fixture: el backend se inició con `NODE_ENV=test`, y `src/app.ts` usa `admin123` como fallback de seed fuera de producción; Playwright usó `E2E_ADMIN_PASSWORD=FictionalAdmin!2026`. El login inicial, por tanto, no valida 2FA. No se modificó backend ni tests/fixtures ante evidencia incompleta.
- Backend y Vite se detuvieron, PostgreSQL fue apagado y se eliminó el clúster temporal; no se ejecutaron todavía los demás flujos, suites, builds ni validaciones.

- La suite dirigida `npx playwright test --grep 'real browser|limited account'` se ejecutó contra los servidores/API y base reales, pero **falló 2/2**; por tanto la cobertura auth no está aprobada.
- El flujo 2FA falló al generar localmente el TOTP: otplib reportó `Invalid Base32 string: Unknown letter ":"`. El snapshot del navegador sí mostró una clave base32 bajo «Clave manual»; el caso necesita corregir la extracción de esa clave y rerun.
- El caso de cuenta limitada falló porque POST `/api/roles` no retornó éxito. No se capturó el body/status en la aserción, así que no se atribuye causa sin evidencia. Ese caso aún no establece navegación restringida ni denegación API.
- No se ejecutaron build ni suite completa de seguridad/E2E tras estos cambios. El selector de login y los casos auth se ejecutaron con la misma DB; no se declara aislado el estado de LoginAttempt entre pruebas. El fallo previo de login inválido del conjunto general evidencia que ese aislamiento es necesario antes de afirmar resultado.
- `npm run build` (backend TypeScript) y `frontend/npm run build` terminaron correctamente después de los cambios.

## Estado

UI existente provee setup/verify/disable 2FA y login con tempToken/code. El router ya define permisos por ruta; navegación superior existente permite evaluar controles, sin necesitar añadir controles UI. No se modificó backend. Este informe conserva los fallos reales y no equivale a aprobación de seguridad.

## Rerun reproducible con cluster temporal (2026-11-05, continuación)

- Se creó PostgreSQL con `initdb`/`pg_ctl` bajo `%LOCALAPPDATA%\Temp\opencode\task6-auth-rerun`, puerto 58342, con bases nuevas y migraciones Drizzle. Playwright levantó backend y Vite desde `playwright.config.ts` (API 3339, UI 55939), `E2E_EXTERNAL_SERVERS` quedó sin definir; `CORS_ORIGIN=http://127.0.0.1:55939`. Cluster detenido al concluir.
- RED inicial, grep 2FA/limited: 2/2 fallidos. El POST `/api/roles` fue **401 `{"error":"missing token"}`**; en esa ejecución el test no había esperado el resultado de login. El fallo 2FA mostró que `getByLabel("Código de verificación")` no encuentra el input: el `<label>` de `Settings.vue` no está asociado al `<input>`.
- Se modificó solo `tests/e2e/main-flows.spec.ts`: locator por `inputmode=numeric`, captura de status/body login y cookies (nombre/HttpOnly), espera de navegación al terminar login. Las siguientes ejecuciones mostraron sesión/2FA persistente entre tests; se ajustó el fixture para logout de API y limpiar `inv_user`/`inv_token`, y el orden de los casos. No se cambió backend.
- La última ejecución dirigida sigue fallando 2/2 al esperar que el login admin abandone `/login`; la respuesta login pasa `ok()`, pero no se estableció por qué no navega ni se obtuvo resultado verde de 2FA/cuenta limitada. Task 6 no está aprobado; se conservaron detalles en `test-results/`.
- `npm run build` y `npm --prefix frontend run build`: ambos exitosos. `npm run test:security`: 1 archivo/6 tests omitidos. `npm test`: 7 pruebas de migraciones fallidas y 42 omitidas porque el proceso se lanzó sin `DATABASE_URL`; no se considera verificación válida. E2E completo/suites no constituyen aprobación.
- CORS de origen no confiable no se verificó en este rerun. `E2E_EXTERNAL_SERVERS` no se exportó. No se arrancó backend aparte con entorno alterno.
