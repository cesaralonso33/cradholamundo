# Modernización incremental de Inventario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar una copia independiente del sistema de inventario con Drizzle, validación robusta, pruebas automatizadas, OpenAPI y Docker reproducible sin perder funcionalidades.

**Architecture:** Mantener Vue 3/Vite/Tailwind en frontend y Fastify 5 en backend. Sustituir Prisma gradualmente por Drizzle sobre PostgreSQL, conservando contratos HTTP y reglas de negocio; retirar Prisma solo después de pruebas de equivalencia.

**Tech Stack:** Node.js LTS, TypeScript estricto, Fastify, Vue 3, Vite, Pinia si aporta estado centralizado, Zod, Drizzle ORM/Kit, PostgreSQL, Vitest, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-05-modernizacion-inventario-design.md`

## Global Constraints

- No modificar el proyecto original en `C:\laragon\www\inventario`.
- No copiar datos reales, uploads, dependencias instaladas, artefactos compilados ni secretos.
- No ejecutar migraciones destructivas ni contra la base original.
- No eliminar módulos ni rutas existentes.
- Toda afirmación final debe estar respaldada por comandos ejecutados y resultados registrados.

## Review Focus

- Operaciones concurrentes de inventario no deben producir cantidades inconsistentes; prueba en la tarea de persistencia.
- Restauraciones y cierres inválidos deben rechazar datos sin dejar transacciones parciales; prueba en backend.
- Permisos de rol y endpoints de administración deben bloquear accesos no autorizados; prueba en seguridad/API.
- Subidas de archivos y entradas grandes/malformadas no deben exponer rutas ni provocar errores no controlados; prueba en validación.
- Arranque limpio de Docker debe esperar PostgreSQL y responder en health checks; prueba en infraestructura.

### Task 1: Línea base y documentación operativa

**Files:**
- Modify: `PROGRESO_MIGRACION.md`
- Create: `REPORTE_PRUEBAS.md`, `MATRIZ_FUNCIONALIDADES.md`, `ARQUITECTURA.md`, `SEGURIDAD.md`, `INSTALACION_DOCKER.md`
- Test: comandos de build y Vitest existentes

**Interfaces:** registra el estado real inicial y no cambia la aplicación.

- [ ] Ejecutar `npm run build`, `npm test`, `npm run build` dentro de `frontend` y `npm test` dentro de `frontend`; registrar salida y fallos.
- [ ] Inspeccionar dependencias con `npm audit --audit-level=high` en ambas aplicaciones; registrar vulnerabilidades sin ocultarlas.
- [ ] Completar la matriz de rutas, pantallas, permisos, importaciones, exportaciones y adjuntos.
- [ ] Documentar la arquitectura actual y el protocolo reproducible de pruebas.

### Task 2: Esquema Drizzle y migraciones aisladas

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, `drizzle/0000_initial.sql`
- Modify: `package.json`, `.env.example`, `.gitignore`
- Test: `tests/db/schema.test.ts`, `tests/db/migrations.test.ts`

**Interfaces:** exportar tablas Drizzle tipadas, cliente singleton y configuración de migraciones.

- [ ] Añadir únicamente dependencias necesarias (`drizzle-orm`, `drizzle-kit`, driver PostgreSQL y `zod`) con versiones compatibles.
- [ ] Traducir las 12 entidades, columnas, defaults, índices, claves únicas, arrays y políticas de borrado del esquema Prisma.
- [ ] Generar SQL versionado desde el esquema; revisar que no contenga drops destructivos.
- [ ] Levantar PostgreSQL aislado con Docker o una URL de prueba y ejecutar migraciones desde cero.
- [ ] Probar claves únicas, foreign keys, cascadas, `SetNull`, defaults y una transacción de inventario.

### Task 3: Capa de repositorios y servicios

**Files:**
- Create: `src/db/repositories/*.ts`, `src/services/*.ts`, `src/lib/errors.ts`, `src/lib/validation.ts`
- Modify: `src/lib/*.ts`
- Test: `tests/services/*.test.ts`

**Interfaces:** repositorios tipados para productos, movimientos, usuarios, roles, empleados, papelería, auditoría, settings y backup; servicios con transacciones explícitas.

- [ ] Extraer consultas Prisma preservando filtros, paginación y orden actual.
- [ ] Implementar movimientos y cierre de pedidos con transacción y validación de cantidades/estado.
- [ ] Centralizar errores HTTP y validación Zod sin exponer stack traces ni secretos.
- [ ] Escribir primero pruebas unitarias de reglas de negocio y luego hacerlas pasar.

### Task 4: Migración de rutas y contrato OpenAPI

**Files:**
- Modify: `src/routes/*.ts`, `src/app.ts`
- Create: `src/openapi.ts`, `docs/openapi.yaml`, `tests/integration/*.test.ts`

**Interfaces:** conservar todas las rutas `/api` y códigos/respuestas compatibles; añadir documentación OpenAPI ejecutable.

- [ ] Cambiar cada ruta de Prisma a repositorios/servicios Drizzle por dominio, sin alterar autorización.
- [ ] Añadir esquemas Zod para cuerpos, parámetros y query strings.
- [ ] Definir errores 400/401/403/404/409/413/429/500 de forma uniforme.
- [ ] Cubrir login, permisos, CRUD de productos, movimientos, empleados/archivos, papelería, backup y health con PostgreSQL real.
- [ ] Verificar que respuestas y restricciones mantienen la semántica original.

### Task 5: Frontend y validación de flujos

**Files:**
- Modify: `frontend/src/api.ts`, `frontend/src/auth.ts`, `frontend/src/router.ts`, `frontend/src/views/*.vue`, `frontend/src/components/*`
- Create: `frontend/src/stores/*.ts`, `frontend/src/validation/*.ts`, `frontend/src/**/*.test.ts`

**Interfaces:** cliente HTTP centralizado, estado de sesión/permisos y formularios validados; rutas y flujos existentes permanecen disponibles.

- [ ] Mantener las pantallas actuales y migrar estado compartido a Pinia solo donde reduzca duplicación.
- [ ] Validar formularios con Zod y mostrar errores API sin perder el estado local Dexie.
- [ ] Probar login, navegación por permisos, inventario, papelería, empleados y configuración.
- [ ] Ejecutar build y Vitest frontend en cada cambio relevante.

### Task 6: Seguridad, pruebas E2E y rendimiento

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/*.spec.ts`, `tests/security/*.test.ts`
- Modify: `package.json`, `frontend/package.json`, `PROGRESO_MIGRACION.md`, `SEGURIDAD.md`

**Interfaces:** comandos reproducibles para integración, E2E y seguridad contra una instancia aislada.

- [ ] Configurar Playwright contra frontend/backend levantados localmente y probar los flujos principales.
- [ ] Verificar cookies, expiración JWT, 2FA, rate limits, permisos, validación, CORS, headers y no exposición de secretos.
- [ ] Ejecutar pruebas de concurrencia de movimientos y respaldos/restauraciones.
- [ ] Ejecutar auditoría de dependencias y registrar mitigaciones o bloqueos reales.

### Task 7: Docker, migración final y entrega

**Files:**
- Modify: `Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`, `README.md`, `DEPLOY.md`, `.env.example`, `.env.docker.example`
- Create: `docker-compose.test.yml`, scripts de backup/restore y health checks
- Test: build y arranque limpio de Compose

**Interfaces:** `docker compose up --build` arranca db/backend/frontend con migraciones no destructivas y health checks.

- [ ] Cambiar el arranque backend a `drizzle-kit migrate` o runner equivalente, nunca `db push --accept-data-loss`.
- [ ] Añadir health checks de PostgreSQL, backend y frontend con dependencias saludables.
- [ ] Probar build sin caché, comunicación entre servicios, health endpoints y persistencia de volúmenes.
- [ ] Retirar Prisma solo cuando todas las pruebas de equivalencia pasen; conservar el historial de migración.
- [ ] Completar README, arquitectura, instalación, backup/restore, matriz, seguridad y reporte de pruebas.

### Task 8: Verificación final y revisión

**Files:**
- Modify: todos los documentos de entrega y `PROGRESO_MIGRACION.md`

- [ ] Ejecutar la batería completa backend/frontend, integración, E2E, seguridad, compilación y Docker.
- [ ] Comparar funcionalidades con el proyecto original sin modificarlo.
- [ ] Registrar cada comando, resultado, limitación y prueba pendiente.
- [ ] No declarar completado si existe una prueba obligatoria fallida, vulnerabilidad crítica o bloqueo de infraestructura.
