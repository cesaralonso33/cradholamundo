# Task 6 auth E2E investigation

Date: 2026-11-05. Run in an isolated worktree with a fresh disposable PostgreSQL 14 database (`inventory_auth`, port 55849). Playwright started the backend (3339) and Vite proxy (55949) through the configured `webServer`; `E2E_EXTERNAL_SERVERS` was unset. Explicit process variables included `DATABASE_URL`, `ADMIN_PASSWORD`, `E2E_ADMIN_PASSWORD`, `E2E_API_URL`, `E2E_BASE_URL`, and `CORS_ORIGIN=http://127.0.0.1:55949`. No repository env file or source-tree database was used.

## Findings

- Instrumented browser login returned `POST http://127.0.0.1:55949/api/auth/login` status 200 with a normal `{token,user}` response. The API URL was the Vite same-origin proxy, not a direct browser request to the backend. `inv_user` was populated, the browser context had an HttpOnly `token` cookie, and after the click/router completed the URL changed from `/login` to `/`.
- The same browser session sent that cookie on `POST http://127.0.0.1:55949/api/roles`; it returned 200 with the created role. This reproduces neither the earlier reported 401 nor a proxy, CORS, `setUser`, or router failure under managed Playwright servers and explicit URLs. The login response event occurs before SPA navigation settles, so a URL sampled immediately at response time can still be `/login`.
- The repeatable 2FA failure was in the test selectors. `Login.vue` and `Settings.vue` render labels as siblings without `for`/input association, so `getByLabel("Código")` and the settings `getByLabel(...)` selectors do not resolve. Updated the test to locate the existing password and numeric-code inputs directly; no product behavior was changed.
- A temporary CORS probe with explicit `CORS_ORIGIN` returned `Access-Control-Allow-Origin: http://127.0.0.1:55949` for the configured origin and no ACAO header for `https://untrusted.invalid` (401 auth statuses were expected for the unauthenticated `/api/auth/me` requests). CORS is therefore correctly restricted when configured; the prior unrestricted-origin finding applies to the intentionally permissive non-production default when the variable is absent.

## Verification

- Fresh-database `npm run db:migrate`: passed.
- Full `npx playwright test` with managed `webServer`: **5 passed**, including main admin flows, invalid login, anonymous redirects, limited account authorization, and the full 2FA enable/login/disable flow.
- Temporary explicit-origin CORS probe through managed `webServer`: **1 passed**; the diagnostic test file was removed afterward.
- Browser console showed expected unauthenticated 401s during pre-auth/anonymous checks and expected 403 for the limited account. No browser page errors were observed. Auth diagnostic response bodies contained tokens and were not copied into this report.

The earlier `POST /api/roles` 401 could not be reproduced using the isolated database and exact managed-server configuration; the available evidence does not establish a root cause for that historical run. No backend, proxy, or CORS implementation change was warranted.
