# Task 1 — Línea base y documentación operativa

**Estado: completada con bloqueo de verificación backend.**

Se trabajó solo en `C:\laragon\www\proyecto-modernizado`. No se modificó el proyecto original, no se emplearon datos reales, no se desplegó ni publicó. No se modificó código de aplicación.

## Documentación entregada

- `REPORTE_PRUEBAS.md`: comandos y resultados reales, incluyendo fallo backend y auditoría.
- `MATRIZ_FUNCIONALIDADES.md`: rutas UI/API, permisos observados, importaciones, exportaciones y adjuntos.
- `ARQUITECTURA.md`: arquitectura actual y flujo de datos.
- `SEGURIDAD.md`: controles, riesgos y dependencias pendientes.
- `INSTALACION_DOCKER.md`: instalación local segura con advertencias de estado aún no validado.
- `PROGRESO_MIGRACION.md`: casilla de línea base actualizada.

## Evidencia

- Backend `npm ci`: instalado 233 paquetes. Los scripts de instalación de Prisma quedaron sin aprobar; ejecutar `npx prisma generate` resolvió la inicialización del cliente.
- Backend `npm run build`: pasa después de generación.
- Backend `npm test`: 1 suite fallida porque `DATABASE_URL` falta; el test de health inicia seeds que requieren PostgreSQL. No se simuló una base ni se ocultó el fallo.
- Backend `npm audit --audit-level=high`: cero vulnerabilidades, exit code 0.
- Frontend `npm run build`: pasa, Vite transformó 60 módulos.
- Frontend `npm test`: 1 archivo y 2 tests pasan.
- Frontend `npm audit --audit-level=high`: cinco moderadas transitivas; cero altas/críticas según umbral. No se ejecutó fix forzado que implicaba cambio breaking.
- `git diff --check`: sin errores de whitespace.

Los comandos completos, mensajes relevantes y protocolo de repetición están en `REPORTE_PRUEBAS.md`. No se ejecutó Docker.

## Preocupaciones

1. Backend requiere una instancia PostgreSQL explícitamente aislada y `DATABASE_URL` para completar la prueba; suite no verde en este entorno.
2. La instalación limpia necesita `prisma generate`, ya que npm reportó scripts no aprobados.
3. Compose contiene defaults inseguros y arranque con `db push --accept-data-loss`; no usar en producción.
4. Cookie `secure:false` y dependencias moderadas frontend necesitan seguimiento.

Commit: se registra el hash en la respuesta final.

## Corrección de revisión de Task 1

- Archivo actualizado: `MATRIZ_FUNCIONALIDADES.md`.
- Verificación de fuente: leídos `src/routes/employees.ts` (rutas y `preHandler` líneas 13–142) y `src/routes/papeleria.ts` (rutas y guardas líneas 17–244). Corregida creación de empleados (`POST /api/employees`, `authenticate` + `requirePermission("employees")`), importación de empleados (`POST /api/employees/import`, `authenticate` + `adminOnly`) y alta de artículo (`POST /api/papeleria`, `authenticate` + `adminOnly`). Se expandieron las operaciones de ambos módulos con métodos y guards declarados.
- Comandos/verificaciones ejecutados: `git diff --check` (sin errores); `Select-String` comprobó que la matriz contiene rutas de creación/importación y guards citados; lectura manual del diff comparada con los handlers.
- Resultado: los guards documentados coinciden con el código observado. No se modificó código de producción; no se repitieron builds/tests porque el cambio es documental.
