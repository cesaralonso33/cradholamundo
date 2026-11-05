# Matriz funcional actual

Inventario observado en frontend router y rutas Fastify. Los permisos de la UI no sustituyen autorización backend. Administración indica guardas observadas en handler; el control por módulo se evalúa además en permisos.

| Ruta UI / pantalla | API / operaciones | Acceso observado | Funciones |
|---|---|---|---|
| `/login` Login | `/api/auth/register`, `/login`, `/2fa/complete`, `/logout`, `/me`, `/2fa/setup`, `/2fa/verify`, `/2fa/disable` | Pública login; register users; 2FA según sesión | Login, registro, 2FA |
| `/` Inventory | `/api/products` GET/POST, `/:sku` GET/PUT/DELETE, `/:sku/archive` POST, `/:sku/history` GET; `/api/inventory/movement` POST | products; delete admin; edición propia/admin | captura, consulta, edición, movimiento, archivo e historial |
| `/history` History | `/api/products/:sku/history` | history/products permiso | historial ubicación paginado |
| `/users` Users | `/api/users` GET/PUT/DELETE | users; protección último admin; no autoeliminación | usuarios y roles |
| `/roles` Roles | `/api/permissions`; `/api/roles` GET/POST; `/:id` PUT/DELETE; `/options` | admin, options users | roles y permisos |
| `/employees` Employees | `/api/employees` GET/POST/GET id/DELETE; `/import` POST; `/:id/constancias` GET/POST; `/api/constancias/:id` DELETE | employees, algunas operaciones admin | import Excel y adjuntos |
| `/papeleria` Papeleria | `/api/papeleria` GET/POST/PUT/DELETE; `/import` POST; `/orders` GET/POST; `/orders/:id` GET/PUT; `/orders/:id/close` POST | papeleria; catálogo/cierre admin | artículos, importación, pedidos y cierre |
| `/settings` Settings | `/api/settings` GET/PUT; `/api/settings/api-key` GET/POST/DELETE; `/api/settings/api-enabled` PUT | settings; API key/enable admin | configuración y API key |
| `/audit` Audit | `/api/audit-logs` GET | admin | auditoría filtrada/paginada |
| `/api-docs` ApiDocs | documentación UI; endpoints `/api/*` | api permiso | consulta de API |
| — | `/health`, `/api/health` GET | público | health y estado DB |
| — | `/api/backup` GET, `/api/backup/restore` POST | admin | exportación/restauración JSON; límite 50 MiB |

Importaciones: empleados y papelería por Excel, admin. Exportación: respaldo JSON admin; excluye archivos físicos de constancias según README. Adjuntos: constancias multipart, extensión permitida, guardados en volumen uploads. Sin inventario separado de botones UI por falta de pruebas visuales; las pantallas están identificadas en router.
