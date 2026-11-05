# Informe Task 2 — esquema Drizzle y migraciones aisladas

## Implementado

- `src/db/schema.ts`: entidades Drizzle tipadas para los 13 modelos de `prisma/schema.prisma`, índices, únicos, arrays, defaults y políticas de borrado. Incluye generador CUID compatible con la forma (25 caracteres) de los IDs del esquema, `$onUpdate` y tipos inferidos; `createProductSchema` valida defaults de inserción con Zod.
- `src/db/client.ts`: cliente Drizzle tipado sobre `pg`, compartido en desarrollo.
- `drizzle.config.ts`, `drizzle/0000_initial.sql` y metadata versionada; comandos `db:generate`, `db:migrate` y `db:check`.
- Dependencias añadidas: `drizzle-orm`, `pg`, `zod`, `drizzle-kit`, `@types/pg`.
- Pruebas `tests/db/schema.test.ts` y `tests/db/migrations.test.ts`.

## Decisiones de correspondencia

La fuente autoritativa fue `prisma/schema.prisma`; las migraciones históricas no se utilizaron como contrato. Se conservaron los nombres de tabla PostgreSQL por defecto de Prisma (`Product`, `InventoryMovement`, etc.) porque el esquema no declara `@@map`; las columnas preservan sus identificadores declarados. Prisma PostgreSQL `DateTime` se representa como `timestamp(3) without time zone`. `created_at`/`last_attempt` mantienen `now()` SQL; Prisma `cuid()` y `@updatedAt` no son defaults SQL, por lo que se generan/actualizan desde Drizzle. La cobertura corresponde a los trece modelos del esquema.

## Verificación

- RED observado: ambas nuevas suites fallaron inicialmente por ausencia del esquema y la migración.
- `npm run db:generate`: generó 13 tablas, 24 índices, 7 claves foráneas.
- `npm run db:check`: correcto.
- Migración aplicada desde cero en PostgreSQL temporal iniciado con `initdb` (DB `task2`, `127.0.0.1:55432`); no se usaron datos reales. Comprobación SQL transaccional con rollback verificó índices únicos, FK, `SetNull`, cascada y actualización de inventario; todo correcto.
- `npm run build`: correcto.
- `npm test` sin `DATABASE_URL`: falla el test preexistente `tests/health.test.ts` al inicializar Prisma por variable de entorno ausente (igual requisito registrado en reporte base). Con `DATABASE_URL=postgresql://postgres@127.0.0.1:55432/task2`: 3 archivos y 6 pruebas pasan.
- Docker no está instalado; el PostgreSQL aislado local permitió completar la validación solicitada.
- No se modificaron rutas ni servicios. No se modificó el proyecto original.

## Fix report — hallazgos de revisión

- **DATABASE_URL obligatorio:** removí la URL de respaldo. `drizzle.config.ts` ahora falla con un mensaje explícito si falta `DATABASE_URL`, incluyendo los comandos `db:migrate` y `db:check` (también impide generar comandos contra un destino implícito). Una prueba ejecuta ambos comandos sin la variable y verifica el error.
- **Pruebas de base reproducibles:** `npm run test:db` requiere `DATABASE_URL` y lanza error claro si falta; no hay skip de la base ausente. Cada ejecución crea una base temporal `drizzle_test_*`, corre `drizzle-kit migrate` desde cero, valida tablas/defaults/los 24 índices y las siete FK con sus acciones y ejecuta comprobaciones de unicidad, cascada, `SetNull` e inventario; luego elimina la base temporal. Requiere servidor PostgreSQL aislado y permiso `CREATE/DROP DATABASE`.
- **Ejecución:** configurar `DATABASE_URL` con credenciales a un servidor PostgreSQL aislado; el nombre de DB de esa URL es solo la conexión de administración y no se modifica. Ejecutar `npm run test:db` para la suite Drizzle. Para `npm test`, la misma URL debe apuntar a una DB temporal ya migrada al esquema Prisma porque incluye el health test preexistente; no lo alteré.
- **RED:** la prueba inicial de configuración falló porque `db:check` utilizó el fallback; con el guard, `db:migrate` y `db:check` sin variable fallan mostrando `DATABASE_URL is required`. La suite de DB sin variable también falla de forma explícita (no pasa ni omite silenciosamente el requisito).
- **GREEN:** en PostgreSQL local aislado, `npm run test:db` pasó (3 archivos/9 pruebas), `npm test` pasó (4 archivos/10 pruebas), `npm run build` y `npm run db:check` pasaron. Las bases `drizzle_test_*` se eliminan al finalizar.

## Fix report — re-revisión de aislamiento dotenv

- **RED reproducido:** la reproducción inicial con `DOTENV_CONFIG_PATH` ficticio ejecutó directamente `drizzle-kit`, no los scripts npm; mostró que dotenv podía reinyectar la URL y por eso no demostraba el comportamiento de `npm run db:*`. Antes del arreglo, la nueva aserción que exige el encabezado npm falló para ambos comandos.
- **Cambio mínimo:** `tests/db/config.test.ts` invoca ahora los comandos reales con `npm --prefix <repo> run db:check` y `npm --prefix <repo> run db:migrate`, desde un `cwd` temporal que no tiene `.env`. `DATABASE_URL` se elimina y `DOTENV_CONFIG_PATH` apunta a un archivo temporal vacío, evitando que se cargue un `.env` del repositorio aunque npm ejecute el script allí. Se comprueba el encabezado del script npm y el mensaje explícito de URL ausente.
- **GREEN:** ambas pruebas de configuración pasaron con `DOTENV_CONFIG_PATH` hostil en el entorno padre, verificando los scripts npm bajo el entorno hijo aislado. En PostgreSQL temporal `127.0.0.1:55434` se aplicó `npm run db:migrate` desde cero; `npm run test:db` pasó (9/9), `npm test` (10/10), `npm run build` y `npm run db:check` pasaron.
- El cluster temporal `pg-task2-final` se detuvo y eliminó después de la verificación. No se modificaron rutas ni el proyecto original.

## Alcance pendiente

La base temporal inicial estuvo en `C:\Users\crad\AppData\Local\Temp\opencode\pg-task2`; después de verificar se detuvo el servidor y se eliminó el cluster temporal. Las DB desechables creadas por la suite también se eliminan en su limpieza. Continuar rutas en la siguiente tarea.
