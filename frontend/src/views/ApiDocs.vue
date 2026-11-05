<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <header class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h1 class="text-xl font-bold">Manual de la API</h1>
      <div class="flex gap-3 text-sm">
        <router-link to="/settings" class="text-blue-600 hover:underline">Configuración</router-link>
        <router-link to="/" class="text-blue-600 hover:underline">← Inventario</router-link>
      </div>
    </header>

    <div class="max-w-4xl space-y-4">
      <section class="bg-white p-4 rounded shadow">
        <h2 class="font-semibold mb-2">URL base</h2>
        <code class="block bg-gray-100 rounded px-3 py-2 text-sm">{{ apiBase }}</code>
        <p class="mt-2 text-sm">Especificación completa: <a class="text-blue-600 hover:underline" :href="`${apiBase}/api/openapi.yaml`">OpenAPI YAML</a> · <a class="text-blue-600 hover:underline" :href="`${apiBase}/api/openapi.json`">OpenAPI JSON</a></p>
        <p class="text-xs text-gray-500 mt-2">
          Todas las rutas de la API comienzan con <code>/api</code>. El servidor de desarrollo escucha en el puerto 3000.
        </p>
      </section>

      <section class="bg-white p-4 rounded shadow">
        <h2 class="font-semibold mb-2">Autenticación</h2>
        <div class="space-y-3 text-sm">
          <div>
            <h3 class="font-medium">1. Token JWT (usuarios de la app)</h3>
            <pre class="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-auto">curl -X POST {{ apiBase }}/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"TU_CONTRASEÑA"}'</pre>
            <p class="text-xs text-gray-500 mt-1">La respuesta incluye <code>token</code>. Úsalo en el encabezado:</p>
            <pre class="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-auto">Authorization: Bearer &lt;token&gt;</pre>
          </div>
          <div>
            <h3 class="font-medium">2. Clave de API (integraciones)</h3>
            <p class="text-xs text-gray-500">
              Genera una clave en <router-link to="/settings" class="text-blue-600 hover:underline">Configuración → API</router-link>.
              Se muestra una sola vez.
            </p>
            <pre class="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-auto">x-api-key: inv_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</pre>
            <p class="text-xs text-gray-500 mt-1">
              La clave de API tiene permisos de administrador. Puedes habilitarla o revocarla en Configuración.
            </p>
          </div>
        </div>
      </section>

      <section class="bg-white p-4 rounded shadow overflow-auto">
        <h2 class="font-semibold mb-2">Endpoints principales</h2>
        <table class="min-w-full text-sm">
          <thead class="bg-gray-100">
            <tr>
              <th class="text-left px-3 py-2">Método</th>
              <th class="text-left px-3 py-2">Ruta</th>
              <th class="text-left px-3 py-2">Descripción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in endpoints" :key="e.method + e.path" class="border-t">
              <td class="px-3 py-1.5 font-mono text-xs">{{ e.method }}</td>
              <td class="px-3 py-1.5 font-mono text-xs">{{ e.path }}</td>
              <td class="px-3 py-1.5">{{ e.description }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="bg-white p-4 rounded shadow">
        <h2 class="font-semibold mb-2">Ejemplos</h2>

        <h3 class="font-medium text-sm mt-3">Listar productos (paginado)</h3>
        <pre class="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-auto">curl "{{ apiBase }}/api/products?page=1&pageSize=20" \
  -H "x-api-key: TU_API_KEY"</pre>

        <h3 class="font-medium text-sm mt-3">Crear / actualizar producto</h3>
        <pre class="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-auto">curl -X POST {{ apiBase }}/api/products \
  -H "Content-Type: application/json" \
  -H "x-api-key: TU_API_KEY" \
  -d '{"sku":"SKU-001","name":"Producto","category":"General","quantity":1}'</pre>

        <h3 class="font-medium text-sm mt-3">Historial de ubicaciones</h3>
        <pre class="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-auto">curl "{{ apiBase }}/api/products/SKU-001/history?page=1&pageSize=20" \
  -H "x-api-key: TU_API_KEY"</pre>

        <h3 class="font-medium text-sm mt-3">Pedidos de papelería</h3>
        <pre class="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-auto">curl "{{ apiBase }}/api/papeleria/orders" \
  -H "x-api-key: TU_API_KEY"</pre>

        <h3 class="font-medium text-sm mt-3">Respaldo completo</h3>
        <pre class="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-auto">curl "{{ apiBase }}/api/backup" \
  -H "x-api-key: TU_API_KEY" -o respaldo.json</pre>
      </section>

      <section class="bg-white p-4 rounded shadow text-sm">
        <h2 class="font-semibold mb-2">Notas</h2>
        <ul class="list-disc ml-5 space-y-1 text-gray-600">
          <li>Los errores devuelven JSON con la forma <code>{ "error": "mensaje" }</code>.</li>
          <li>Las listas paginadas aceptan <code>page</code> y <code>pageSize</code> (máximo 100).</li>
          <li>La clave de API se guarda cifrada (hash SHA-256); si la pierdes, genera una nueva.</li>
          <li>El respaldo JSON no incluye los archivos de constancias de <code>uploads/</code>.</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const apiBase = import.meta.env.VITE_API_BASE || window.location.origin;

const endpoints = [
  { method: "POST", path: "/api/auth/login", description: "Iniciar sesión y obtener token JWT" },
  { method: "GET", path: "/api/products", description: "Listar/buscar productos (page, pageSize, search)" },
  { method: "POST", path: "/api/products", description: "Crear o actualizar producto por SKU" },
  { method: "GET", path: "/api/products/:sku", description: "Obtener un producto" },
  { method: "POST", path: "/api/products/:sku/archive", description: "Mover producto a Archivo" },
  { method: "GET", path: "/api/products/:sku/history", description: "Historial de ubicaciones paginado" },
  { method: "POST", path: "/api/inventory/movement", description: "Registrar entrada/salida" },
  { method: "GET", path: "/api/employees", description: "Listar empleados (admin)" },
  { method: "GET", path: "/api/papeleria", description: "Listar artículos de papelería" },
  { method: "GET", path: "/api/papeleria/orders", description: "Listar pedidos (usuario: propios; admin: todos)" },
  { method: "POST", path: "/api/papeleria/orders", description: "Crear pedido y asignar folio" },
  { method: "POST", path: "/api/papeleria/orders/:id/close", description: "Cerrar pedido (admin)" },
  { method: "GET", path: "/api/settings", description: "Leer configuración" },
  { method: "GET", path: "/api/backup", description: "Descargar respaldo JSON (admin)" },
  { method: "POST", path: "/api/backup/restore", description: "Restaurar respaldo JSON (admin)" },
];
</script>
