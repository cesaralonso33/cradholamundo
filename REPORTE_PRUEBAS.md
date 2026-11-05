# Reporte de pruebas — línea base

Fecha de ejecución: 2026-11-05. Entorno Windows, Node.js v22.18.0/npm (la versión de npm no fue registrada). No se usaron datos reales ni se desplegó.

## Instalación

`npm ci` en backend instaló 233 paquetes y auditó 234: 0 vulnerabilidades. Se generó Prisma Client con `npx prisma generate` (necesario tras instalación limpia; la política de instalación omitió scripts automáticos). `frontend/node_modules` ya existía y no se reinstaló.

## Resultados observados

| Aplicación | Comando | Resultado |
|---|---|---|
| Backend | `npm run build` | Pasa después de `prisma generate`; TypeScript termina sin errores. La primera compilación, antes de generar Prisma Client, falló por 11 parámetros implícitos `any`; atribuible al cliente no generado. |
| Backend | `npm test` | Falla: 1 test suite, el health test no puede inicializar DB; `DATABASE_URL` no está configurada y el arranque hace seeds conectados a PostgreSQL. Antes de generar Prisma Client tampoco inicializaba el cliente. |
| Backend | `npm audit --audit-level=high` | 0 vulnerabilidades; exit code 0. |
| Frontend | `npm run build` | Pasa: Vite transformó 60 módulos y generó bundle de producción. |
| Frontend | `npm test` | Pasa: 1 archivo, 2 tests. |
| Frontend | `npm audit --audit-level=high` | Reporta 5 vulnerabilidades moderadas (globs/minimatch transitivas desde `@vue/test-utils`/`js-beautify`); ninguna alta/crítica. Exit code 0 por el umbral solicitado. `npm audit fix --force` sugeriría downgrade de breaking change y no se ejecutó. |

Comandos solicitados se ejecutaron en cada raíz. No se arrancó PostgreSQL para evitar un servicio/datos adicionales; hace falta una DB de pruebas aislada para obtener suite backend verde.

## Task 7 — contenedores y despliegue (2026-11-05)

- `npm run build` backend y frontend: aprobados.
- `npm test` frontend: 23/23 aprobados.
- `npm test` backend: bloqueado por falta de `DATABASE_URL`/PostgreSQL de pruebas. Resultado observado: 19 tests aprobados, 42 omitidos y 7 errores de setup en suites que crean bases aisladas.
- Docker: bloqueado. PowerShell indica literalmente que `docker` no se reconoce como nombre de un cmdlet, función, archivo de script o programa ejecutable. No se ejecutaron `docker compose config`, build ni arranque; runtime no verificado.
- Informe: `.superpowers/sdd/2026-11-05-modernizacion-inventario/docker-report.md`.

## Protocolo reproducible

En la raíz: `npm ci`, `npx prisma generate`, `npm run build`, `npm test`, `npm audit --audit-level=high`. Requiere `DATABASE_URL` apuntando a PostgreSQL de pruebas aislada para ejecutar health tests. En `frontend`: `npm ci`, `npm run build`, `npm test`, `npm audit --audit-level=high`.

## Task 6 — Playwright/seguridad

PostgreSQL 14 nuevo, puerto 55436, base `inventory_task6` en `%LOCALAPPDATA%\Temp\opencode\task6-pg`; migraciones Drizzle aplicadas. E2E en backend 3336 y frontend 55936: 3/3 aprobados en Chromium, incluido movimiento desde formulario y verificación del stock persistido, login inválido, navegación autenticada y redirect anónimo. Primer intento detectó selector ambiguo del formulario; selector Playwright exacto corregido, rerun verde. La suite de seguridad live quedó parcial, no aprobada como conjunto: CORS, contrato/headers, autorización y entrada malformada pasan; hubo fallos por rate-limit/estado de LoginAttempt contaminado entre corridas. No se probaron 2FA, usuario limitado, pedido UI, constancia/archivo permitido, backup export/restore ni concurrencia backup/restore. Detalle: `e2e-security-report.md`.

Backend `npm test`: 62 passed, 6 skipped; backend build pasa. Frontend: 19/19 tests y build pasa. No se afirma aprobación de los flujos E2E aún pendientes. Docker no disponible. No se utilizó ni modificó el servicio original ni su puerto 3000.
