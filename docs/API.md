# Manual de la API

La aplicación expone una API REST construida con Fastify. La URL base de desarrollo es `http://localhost:3000`.

También puedes consultar este manual dentro de la app en **Configuración → API → Ver manual de API** (`/api-docs`).

## Autenticación

### 1. Token JWT (usuarios de la aplicación)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"TU_CONTRASEÑA"}'
```

La respuesta incluye un `token`. Envíalo en cada solicitud:

```
Authorization: Bearer <token>
```

### 2. Clave de API (integraciones externas)

1. Entra a **Configuración → API** como administrador.
2. Pulsa **Generar clave**.
3. Copia la clave (solo se muestra una vez).
4. Envía la clave en el encabezado:

```
x-api-key: inv_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

La clave de API tiene permisos de administrador. Puedes habilitarla, regenerarla o revocarla desde Configuración.

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión y obtener token |
| GET | `/api/products` | Listar/buscar productos (`page`, `pageSize`, `search`) |
| POST | `/api/products` | Crear o actualizar producto por SKU |
| GET | `/api/products/:sku` | Obtener producto |
| POST | `/api/products/:sku/archive` | Mover producto a Archivo |
| GET | `/api/products/:sku/history` | Historial de ubicaciones paginado |
| POST | `/api/inventory/movement` | Registrar entrada/salida |
| GET | `/api/employees` | Listar empleados (admin) |
| GET | `/api/papeleria` | Listar artículos de papelería |
| GET | `/api/papeleria/orders` | Listar pedidos (propios o todos si admin) |
| POST | `/api/papeleria/orders` | Crear pedido y asignar folio |
| POST | `/api/papeleria/orders/:id/close` | Cerrar pedido (admin) |
| GET | `/api/settings` | Leer configuración |
| GET | `/api/settings/api-key` | Estado de la clave de API (admin) |
| POST | `/api/settings/api-key` | Generar clave de API (admin) |
| DELETE | `/api/settings/api-key` | Revocar clave de API (admin) |
| PUT | `/api/settings/api-enabled` | Habilitar/deshabilitar API (admin) |
| GET | `/api/backup` | Descargar respaldo JSON (admin) |
| POST | `/api/backup/restore` | Restaurar respaldo JSON (admin) |

## Ejemplos

### Listar productos

```bash
curl "http://localhost:3000/api/products?page=1&pageSize=20" \
  -H "x-api-key: TU_API_KEY"
```

### Crear producto

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "x-api-key: TU_API_KEY" \
  -d '{"sku":"SKU-001","name":"Producto","category":"General","quantity":1}'
```

### Historial de ubicaciones

```bash
curl "http://localhost:3000/api/products/SKU-001/history?page=1&pageSize=20" \
  -H "x-api-key: TU_API_KEY"
```

### Pedidos de papelería

```bash
curl "http://localhost:3000/api/papeleria/orders" \
  -H "x-api-key: TU_API_KEY"
```

### Respaldo completo

```bash
curl "http://localhost:3000/api/backup" \
  -H "x-api-key: TU_API_KEY" -o respaldo.json
```

## Notas

- Los errores devuelven `{ "error": "mensaje" }`.
- Las listas paginadas aceptan `page` y `pageSize` (máximo 100).
- La clave de API se guarda como hash SHA-256.
- El respaldo JSON no incluye los archivos de constancias en `uploads/`.
