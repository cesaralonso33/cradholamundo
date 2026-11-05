# Task 4 — Migración del dominio inventario

## Alcance

Migradas las rutas existentes de productos, historial de ubicaciones, archive y `/api/inventory/movement` desde Prisma a Drizzle. Uso de repositorios/servicio existentes; se añadió consulta paginada del historial y actualización/eliminación de producto al repositorio. Se mantiene la interfaz HTTP, filtros `search`/`q`, paginación acotada, auditoría, autorización, regla de duplicados y respuestas funcionales legacy. Se añadieron esquemas Zod de parámetros, query y body y mapping centralizado de errores.

## RED → GREEN

- RED reproducible: el caso de payload vacío de creación esperaba `{ "error": "sku and name are required" }`, pero inicialmente recibió `{ "error": "invalid input" }` por el mapping genérico Zod.
- GREEN: añadida respuesta específica compatible para validación legacy (también para nombre faltante en edición y campos faltantes de movimiento); las pruebas de integración volvieron a pasar.
- Una aserción posterior detectó que el historial devolvía las dos ubicaciones esperadas, no que faltara el evento; se corrigió la expectativa para validar que el archive esté entre las entradas, sin imponer orden cuando `created_at` coincide.

## Base real aislada

Instancia PostgreSQL local 14.5, cluster temporal fuera del repo en `C:\Users\crad\AppData\Local\Temp\opencode\pg-task4-data`, puerto `55434`; DB desechable `inventory_task4`, sin datos de aplicación preexistentes.

Comandos ejecutados desde `C:\laragon\www\proyecto-modernizado`:

```powershell
$pg='C:\laragon\bin\postgresql\postgresql-14.5-1\bin'
& "$pg\initdb.exe" -D 'C:\Users\crad\AppData\Local\Temp\opencode\pg-task4-data' -U postgres -A trust --no-locale -E UTF8
& "$pg\pg_ctl.exe" -D 'C:\Users\crad\AppData\Local\Temp\opencode\pg-task4-data' -l 'C:\Users\crad\AppData\Local\Temp\opencode\pg-task4.log' -o '-p 55434 -h 127.0.0.1' start
$env:DATABASE_URL='postgres://postgres@127.0.0.1:55434/inventory_task4'
npx drizzle-kit migrate
npx vitest run tests/integration/products.test.ts
npm run build
npm test
```

Resultados: migraciones Drizzle aplicadas; integración de inventario **3/3**; build TypeScript correcto; suite completa **9 archivos, 33 tests pasados**. El `npm test` completo reutilizó su mecanismo de base aislada para las pruebas DB/auth.

## Cobertura HTTP observada

- Crear, buscar/listar con paginación, editar, historial, archive, borrar y respuesta 404 posterior.
- Respuesta de duplicado 409, faltantes 404, acceso denegado 403 y payload inválido 400 con mensaje de stock requerido.
- Dos salidas `OUT` concurrentes de 4 unidades para saldo 5: una respuesta 200 y otra 400; PostgreSQL refleja saldo 1, un movimiento persistido y una auditoría. Intento de movimiento para SKU ausente devuelve 404 `product not found`.
- Usuario sin acceso de admin no puede editar producto de otra ubicación; delete continúa protegido por admin.

## Commit

La migración inicial se cerró en el commit `b8425d808545c461e44bc93b77a35346600f5a61`. La revisión posterior de hallazgos se registra en un commit separado.

## Correcciones de revisión (2026-11-05)

- Se añadieron pruebas RED en PostgreSQL para cantidad fraccionaria, auditoría fallida y creación concurrente con `prevent_duplicates=true`. Confirmaron la respuesta genérica incorrecta, que la auditoría fallida dejaba confirmar creación y que las dos creaciones pasaban sin serialización.
- Lista filtra ubicación y búsqueda conjuntamente con `AND`; la ruta conserva la precedencia histórica `search || q || ''`. La integración verifica resultados de otra ubicación, `search` vacío con `q` y ambos parámetros con `search` no vacío.
- Movimiento valida cantidad entera positiva con Zod antes del servicio; cantidades no positivas conservan `quantity must be positive`, fracciones devuelven `quantity must be a positive integer`.
- Auditorías de creación/upsert, edición, archive, eliminación y movimiento ahora se insertan mediante el executor de la transacción de la mutación; ya no se usa el helper compartido que ignora fallos. Pruebas con trigger PostgreSQL que rechaza auditoría demuestran rollback de producto y de stock/movimiento.
- Creación serializa por SKU con advisory transaction lock y vuelve a revisar existencia/ajuste de duplicados dentro de la transacción. Edición/archive/eliminación bloquean la fila (`FOR UPDATE`). Archive concurrente devuelve un único éxito y un conflicto, y registra un solo historial.
- La integración comprueba permisos de history/archive, denegación de archive de otro usuario y filtros de ubicación; también prueba que una edición concurrente que omite quantity no pisa una actualización concurrente de quantity.

Verificación real posterior: `npx vitest run tests/integration/products.test.ts` (**8/8**), `npm run build` (**pasa**) y `npm test` (**9 archivos, 38 tests pasados**) con PostgreSQL aislado `inventory_task4` en `127.0.0.1:55434`.
