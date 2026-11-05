# Frontend: formularios de empleados y movimientos de inventario

El formulario de `Employees.vue` envía `name`, `position` y `email`. Se explicitó ese contrato en `apiCreateEmployee` usando el modelo `Employee`, y la prueba de `employeeSchema` ahora valida directamente el payload real del formulario. La validación requiere nombre y acepta posición/email opcionales; no exige `employee_number`, ausente tanto del formulario como del modelo backend.

La inspección de HEAD encontró que el esquema ya no contenía `employee_number`; la prueba anterior era insuficiente (combinaba nombre vacío con `employee_number` vacío, y podía pasar aunque el esquema no lo conociera). Por eso se reemplazó por el caso válido de formulario y se añadió una comprobación explícita del nombre requerido. No fue posible observar RED contra el esquema anterior porque esa versión no está en el checkout; el nuevo caso pasa en el estado existente. Backend y proyecto original no se modificaron.

Se incorporó en `Inventory.vue` un formulario compacto para movimientos IN/OUT, selección de producto por SKU, cantidad entera positiva y nota opcional. Usa `apiMovement` y `inventoryMovementSchema`; es accesible mediante etiquetas/controles nativos, se adapta a móvil y comunica carga, éxito, error, desconexión y conflicto 409. Los movimientos no se ponen en cola cuando no hay red. Pruebas nuevas de schema y envío: RED inicial observado al no existir componente/esquema, GREEN tras implementación.

Verificación: `frontend/npm test` (17/17) y `frontend/npm run build` pasan. Detector Impeccable `detect --json` sobre ambos archivos UI: `[]`. Playwright no pudo iniciar backend porque no está configurado `DATABASE_URL`; se añadió el flujo transaccional que crea producto, registra movimiento desde UI y comprueba stock al estar disponible el entorno PostgreSQL E2E aislado.

## Backup sensible solo para administración

`Settings.vue` conserva el botón de respaldo seguro y añade, dentro del mismo bloque ya restringido a admin, descarga completa restaurable mediante `includeSensitive=true`. Antes de habilitarla se exige una casilla con advertencia explícita de que el archivo contiene contraseñas y secretos TOTP; indica guardarlo cifrado/con acceso restringido. Descargas comparten estado de carga/error, generan nombre de archivo diferenciado y reportan éxito/error accesibles. La capa API mantiene el valor por defecto no sensible.

Tests de `Settings.vue` cubren ocultamiento no admin, confirmación y ruta sensible, y preservación del botón seguro; test de `api.ts` verifica que solo `true` añade el parámetro. RED→GREEN reproducido en el test de API: inicialmente el query sensible no se enviaba, y pasó tras extender el cliente. Verificación final: `frontend npm test` 23/23, `frontend npm run build` correcto, `git diff --check` correcto (solo avisos de normalización LF/CRLF) y detector Impeccable sobre `Settings.vue`: `[]`.

## Selector de productos en movimientos

El selector ya no carga una única página de 100 productos. `InventoryMovementPanel.vue` consulta el endpoint existente `/api/products` con búsqueda enviada al pulsar Buscar y páginas de 20 resultados; ofrece controles accesibles anterior/siguiente y mantiene los formularios nativos, foco de teclado y layout responsive. Carga, error con reintento y búsqueda sin coincidencias se muestran explícitamente. El formulario existente de movimiento conserva su validación, gestión de offline y conflicto 409.

Tests RED→GREEN en `InventoryMovementPanel.test.ts`: producto fuera del listado inicial accesible mediante búsqueda y envío de movimiento; error de catálogo visible y recuperación mediante reintento. RED observado inicialmente al no existir el panel (fallo de resolución del componente); GREEN tras su implementación. Verificación final: `frontend/npm test` 19/19, `frontend/npm run build` correcto, `git diff --check` correcto y detector Impeccable sobre `InventoryMovementPanel.vue`/`Inventory.vue` sin hallazgos (`[]`). No se modificó backend ni proyecto original.

## Navegación global para usuarios autenticados

El encabezado con navegación se movió desde `Inventory.vue` a `App.vue`, por lo que está disponible en todas las vistas autenticadas y queda oculto en `/login`. Se conservaron los enlaces y condiciones existentes por permisos y rol admin, el nombre de usuario, la acción Salir y el indicador de sincronización; el layout permite salto de línea en pantallas estrechas y mantiene foco visible para teclado. `Inventory.vue` conserva sus formularios, panel y tabla sin duplicar el encabezado.

Pruebas Vue/Vitest RED→GREEN en `frontend/src/App.navigation.test.ts`: al inicio fallaban la visibilidad del menú y enlaces en rutas autenticadas; después pasan la visibilidad/nombre/salida, ocultamiento en login y enlaces de permisos/admin. Verificación: frontend `npm test` 26/26, `npm run build` correcto y detector Impeccable en archivos UI (`App.vue`, `Inventory.vue`) sin hallazgos (`[]`). Sin cambios en backend ni proyecto original.
