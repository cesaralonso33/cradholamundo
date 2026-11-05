# Arquitectura actual

- Frontend SPA: Vue 3, Vue Router, Vite, Tailwind; Dexie/IndexedDB para capturas locales, cliente API en `frontend/src/api.ts`.
- Backend: Node.js 22, TypeScript, Fastify 5. `src/app.ts` registra Helmet, CORS, cookies, compresión, rate limiting, multipart, estáticos `/uploads/`, health y módulos.
- Persistencia actual: PostgreSQL mediante Drizzle ORM (`src/db/schema.ts`, `src/db/client.ts`, repositorios y migraciones en `drizzle/`); el arranque siembra roles/admin y papelería. El esquema Prisma descrito en `ANALISIS_INICIAL.md` corresponde al origen histórico de la migración.
- Auth: JWT cookie, bcrypt, bloqueos de intentos y TOTP opcional; permisos por rol en backend y navegación frontend.
- Componentes funcionales: productos/movimientos, usuarios/roles, empleados/constancias, papelería/pedidos, ajustes/API keys, auditoría, backup.
- Operación: Compose PostgreSQL 16 + backend + frontend Nginx; volúmenes `pgdata` y `uploads`; frontend expuesto en puerto configurable.

Flujo: browser → Nginx SPA/API proxy → Fastify → Drizzle → PostgreSQL; archivos via multipart al volumen uploads. Las migraciones versionadas están en `drizzle/`. La especificación API está disponible en `/api/openapi.yaml` y `/api/openapi.json`.
