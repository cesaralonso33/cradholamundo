# Inventario Rápido

Sistema de inventario keyboard-first con módulos de usuarios, empleados, papelería y respaldos.

## Stack

- **Backend:** Node.js + TypeScript + Fastify + Drizzle ORM + PostgreSQL
- **Frontend:** Vue 3 + Vite + Tailwind CSS + Dexie.js
- **Auth:** JWT + bcrypt

## Estructura

```
src/
  app.ts                 # Construcción de Fastify (plugins + rutas)
  index.ts               # Arranque y apagado graceful
  lib/
    auth.ts              # JWT, authenticate y adminOnly
    db/                   # Drizzle schema, PostgreSQL client and repositories
    excel.ts             # Lectura de Excel
    paths.ts             # Rutas de uploads
    settings.ts          # Cache de configuración
  routes/
    auth.ts
    users.ts
    products.ts
    employees.ts
    papeleria.ts
    settings.ts
    backup.ts
drizzle/
  migrations/
frontend/
  src/
    api.ts               # Cliente HTTP centralizado
    auth.ts              # Sesión y roles
    db.ts                # Dexie (IndexedDB)
    router.ts
    settings.ts
    components/
    views/
    utils/format.ts
```

## Despliegue

La forma más sencilla es Docker Compose:

```bash
cp .env.docker.example .env
docker compose up -d --build
```

Consulta [DEPLOY.md](DEPLOY.md) para la guía completa.

## Desarrollo

```bash
# Backend
npm install
npm run db:migrate
npm run dev          # http://localhost:3000

# Frontend
cd frontend
npm install
npm run dev          # http://localhost:55896
```

## Variables de entorno

Copia `.env.example` a `.env` y ajusta `DATABASE_URL` y `JWT_SECRET`.

## Respaldos

En **Configuración** (solo admin):

- **Descargar respaldo JSON:** exporta todas las tablas.
- **Restaurar respaldo:** reemplaza los datos actuales desde un JSON exportado.

Los archivos de constancias (`uploads/`) no se incluyen en el JSON.

## Seguridad

- Cabeceras de seguridad con Helmet.
- Rate limiting global (1000 req/min por IP) y login/registro limitado (8-10 req/min).
- Bloqueo de acceso tras 4 intentos fallidos (15 minutos por defecto, configurable con `LOGIN_MAX_FAILURES` y `LOGIN_BLOCK_MINUTES`).
- Contraseñas con mínimo 8 caracteres, letras y números; hash bcrypt.
- CORS configurable con `CORS_ORIGIN`.
- Validación de extensiones en archivos de constancias.
- JWT_SECRET obligatorio y fuerte en producción.
- Permisos por rol validados en frontend y backend.

## Roles y permisos

El módulo **Roles** (solo administrador) permite crear roles, asignar permisos por módulo y asignar roles a usuarios. Los permisos se validan tanto en el frontend (navegación/rutas) como en el backend (endpoints). El rol `admin` siempre tiene todos los permisos.

## Diagnóstico

```bash
bash scripts/diagnostico.sh
TEST_PASSWORD="tu-password" bash scripts/diagnostico.sh
```

Revisa backend, PostgreSQL, Nginx, proxies, puertos y build del frontend.

## API

La API REST se configura desde **Configuración → API** (solo admin): habilitar/deshabilitar, generar o revocar clave de API. El contrato OpenAPI está en [docs/openapi.yaml](docs/openapi.yaml), se sirve en `/api/openapi.yaml` y `/api/openapi.json`, y está enlazado desde el manual dentro de la app en `/api-docs`.

## Prueba de rendimiento

```bash
npm run perf:seed   # 24,719 registros de historial + 10 usuarios/empleados de prueba
npm run perf:test   # 10 usuarios concurrentes
```
