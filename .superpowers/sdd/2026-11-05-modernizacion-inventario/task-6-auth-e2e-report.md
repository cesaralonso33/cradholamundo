# Task 6 — autenticación E2E (2026-11-05)

## Alcance y entorno

Se añadieron casos Playwright de navegador real para enrolar 2FA en Settings, iniciar sesión mediante el reto de segundo factor, comprobar el uso de cookie HttpOnly y desactivar 2FA; y para crear un rol/cuenta limitada y verificar redirecciones y denegación de API. No se cambió backend ni se usaron mocks. Se creó la base nueva `task6_auth_e2e_20261105` en el PostgreSQL local (puerto 5432), se aplicaron migraciones y Playwright usó API 3337 y frontend 55937 (ninguno es 3000).

## Resultado observado

- La suite dirigida `npx playwright test --grep 'real browser|limited account'` se ejecutó contra los servidores/API y base reales, pero **falló 2/2**; por tanto la cobertura auth no está aprobada.
- El flujo 2FA falló al generar localmente el TOTP: otplib reportó `Invalid Base32 string: Unknown letter ":"`. El snapshot del navegador sí mostró una clave base32 bajo «Clave manual»; el caso necesita corregir la extracción de esa clave y rerun.
- El caso de cuenta limitada falló porque POST `/api/roles` no retornó éxito. No se capturó el body/status en la aserción, así que no se atribuye causa sin evidencia. Ese caso aún no establece navegación restringida ni denegación API.
- No se ejecutaron build ni suite completa de seguridad/E2E tras estos cambios. El selector de login y los casos auth se ejecutaron con la misma DB; no se declara aislado el estado de LoginAttempt entre pruebas. El fallo previo de login inválido del conjunto general evidencia que ese aislamiento es necesario antes de afirmar resultado.
- `npm run build` (backend TypeScript) y `frontend/npm run build` terminaron correctamente después de los cambios.

## Estado

UI existente provee setup/verify/disable 2FA y login con tempToken/code. El router ya define permisos por ruta; navegación superior existente permite evaluar controles, sin necesitar añadir controles UI. No se modificó backend. Este informe conserva los fallos reales y no equivale a aprobación de seguridad.
