# Análisis inicial

## Alcance inspeccionado

Inspección de la copia de trabajo realizada el 2026-11-05. El proyecto original está en `C:\laragon\www\inventario` y no se modifica.

## Arquitectura actual

- **Backend:** Node.js, TypeScript estricto, Fastify 5, Prisma 6 y PostgreSQL.
- **Frontend:** Vue 3, Vite, Vue Router, Tailwind CSS y Dexie/IndexedDB para capturas locales.
- **Autenticación:** JWT en cookie, bcrypt, bloqueo de intentos y TOTP opcional.
- **Autorización:** rol `admin` y permisos por módulo validados en backend y frontend.
- **Archivos:** multipart para constancias y volumen `uploads`.
- **Infraestructura:** Docker Compose con PostgreSQL, backend y frontend servido por Nginx.
- **Pruebas:** Vitest en backend y frontend; existe una prueba de health y una prueba de formato.

## Estructura funcional

### Backend

- `src/app.ts`: plugins Fastify, health checks, semillas y registro de rutas.
- `src/routes/auth.ts`: registro, login, logout, sesión y 2FA.
- `src/routes/products.ts`: productos, movimientos, archivado, historial y filtros.
- `src/routes/users.ts`: listado, edición y eliminación de usuarios.
- `src/routes/roles.ts`: permisos, roles y asignación de roles.
- `src/routes/employees.ts`: empleados, importación y constancias adjuntas.
- `src/routes/papeleria.ts`: artículos, pedidos, cierre e importación.
- `src/routes/settings.ts`: configuración y API key.
- `src/routes/backup.ts`: exportación y restauración JSON.
- `src/routes/audit.ts`: consulta de auditoría.

### Frontend

Rutas y pantallas: login, inventario, historial, usuarios, roles, empleados, papelería, configuración, auditoría y documentación API. Incluye componentes de paginación, formulario rápido, tabla de capturas y estado de sincronización.

## API detectada

Existen endpoints de health (`/health`, `/api/health`) y 52 declaraciones de rutas bajo `/api`, incluyendo autenticación, productos, movimientos, usuarios, roles, empleados, constancias, papelería, configuración, respaldos y auditoría. La matriz completa se consolidará en `MATRIZ_FUNCIONALIDADES.md` durante la migración.

## Modelo de datos

Prisma define 12 entidades: `Product`, `InventoryMovement`, `LocationHistory`, `User`, `AuditLog`, `Setting`, `Role`, `LoginAttempt`, `Employee`, `Constancia`, `PapeleriaItem`, `PapeleriaOrder` y `PapeleriaOrderItem` (12 modelos; el último conjunto incluye relaciones). La base es PostgreSQL y hay claves únicas, índices, relaciones con cascada o `SetNull`, arrays de permisos y valores por defecto.

## Configuración y despliegue

- `Dockerfile` backend multi-stage con Node 22 Alpine.
- `frontend/Dockerfile` multi-stage con Vite y Nginx.
- `docker-compose.yml` con PostgreSQL 16, health check y volúmenes `pgdata`/`uploads`.
- Variables sensibles previstas: `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `ADMIN_PASSWORD`, credenciales PostgreSQL y CORS.
- El Dockerfile actual ejecuta `prisma db push --accept-data-loss`; se sustituirá por migraciones reproducibles y no destructivas.

## Riesgos y deuda técnica

1. Prisma está acoplado a rutas y semillas; la migración a Drizzle debe preservar semántica y transacciones.
2. La documentación OpenAPI es manual (`docs/API.md`) y no se observa un esquema ejecutable central.
3. La cobertura automatizada inicial es reducida frente al número de módulos.
4. La configuración Docker usa valores por defecto inseguros si se despliega sin `.env` propio.
5. No se deben copiar uploads ni dependencias instaladas al entorno modernizado.

## Estrategia aprobada

Migración incremental en esta copia independiente: primero línea base y documentación, después esquema/migraciones Drizzle, repositorios y rutas por módulo, frontend y pruebas; Prisma se conservará hasta demostrar equivalencia y se eliminará al final.
