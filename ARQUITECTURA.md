# Arquitectura actual

- Frontend SPA: Vue 3, Vue Router, Vite, Tailwind; Dexie/IndexedDB para capturas locales, cliente API en `frontend/src/api.ts`.
- Backend: Node.js 22, TypeScript, Fastify 5. `src/app.ts` registra Helmet, CORS, cookies, compresión, rate limiting, multipart, estáticos `/uploads/`, health y módulos.
- Persistencia: PostgreSQL y Prisma 6 (`prisma/schema.prisma`, cliente singleton); arranque siembra roles/admin y papelería. Modelo documentado en `ANALISIS_INICIAL.md`.
- Auth: JWT cookie, bcrypt, bloqueos de intentos y TOTP opcional; permisos por rol en backend y navegación frontend.
- Componentes funcionales: productos/movimientos, usuarios/roles, empleados/constancias, papelería/pedidos, ajustes/API keys, auditoría, backup.
- Operación: Compose PostgreSQL 16 + backend + frontend Nginx; volúmenes `pgdata` y `uploads`; frontend expuesto en puerto configurable.

Flujo: browser → Nginx SPA/API proxy → Fastify → Prisma → PostgreSQL; archivos via multipart al volumen uploads. Es estado inicial, no arquitectura objetivo: despliegue actual usa `prisma db push --accept-data-loss`, y Compose/README tienen defaults inseguros que no deben usarse en producción.
