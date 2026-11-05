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

## Protocolo reproducible

En la raíz: `npm ci`, `npx prisma generate`, `npm run build`, `npm test`, `npm audit --audit-level=high`. Requiere `DATABASE_URL` apuntando a PostgreSQL de pruebas aislada para ejecutar health tests. En `frontend`: `npm ci`, `npm run build`, `npm test`, `npm audit --audit-level=high`.

## Task 6 — Playwright/seguridad

Playwright se ejecutó contra esta copia del backend y frontend, puertos 3300/55900 y la base temporal `inventory_task6` en PostgreSQL 14 (puerto 55434); no se utilizó el servicio original en 3000. `npx playwright test`: 3/3 aprobados tras corregir el selector de input no asociado a `<label>` en el test (sin cambios a la aplicación). Cubre login válido/inválido, navegación de páginas y redirecciones sin sesión; no ejecuta mutaciones UI de movimientos, pedido, constancia o restauración ni completa 2FA.

La prueba security independiente tuvo 6/6 aprobados en `inventory_task6_clean`, una DB nueva aislada: OpenAPI/headers, autorización, entrada malformada, cookie+JWT expirado, Retry-After/lockout y CORS. E2E y security se ejecutaron por separado para impedir lockouts cruzados. Hubo intentos diagnósticos no válidos contra el puerto 3000 del checkout original y una corrida posterior sobre la DB ya bloqueada; no se alteró dicho checkout. `npm test` con `DATABASE_URL` aislada registró 62 aprobados y omitió los seis checks live al no definir `E2E_API_URL`, evitando llamadas accidentales a servicios fuera del test.

`npm run build` backend/frontend pasan; `npm test` frontend: 14/14. Auditoría backend: 4 moderadas en dependencia transitiva de build (`drizzle-kit`/`@esbuild-kit`/`esbuild`), sin fix compatible sugerido; auditoría frontend: 5 moderadas; no se aplicó `--force`. Pruebas de concurrencia preexistentes de salida de stock y cierre de pedido se ejecutan en integración PostgreSQL (véanse informes Task 4); concurrencia específica de backups/restores no fue ejecutada en Task 6. `SEGURIDAD.md` incluye los comandos de ejecución aislada.
