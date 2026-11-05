# Diseño: despliegue continuo sin Docker (VPS + script local)

Fecha: 2026-11-05
Estado: propuesto, pendiente de aprobación

## Intención y por qué

Hoy los cambios llegan al VPS copiando archivos y repitiendo pasos a mano
(ver `DEPLOY.md`). Eso invita a errores: builds viejos, migraciones sin
aplicar, `.env` tocado, y nadie recuerda qué versión está publicada.

Queremos que publicar sea **un solo comando**, repetible, con verificación
automática y con vuelta atrás si algo sale mal.

## Objetivos

- Publicar con un comando desde la máquina de desarrollo (Windows).
- Que el despliegue sea idempotente: correrlo dos veces no rompe nada.
- Verificar el resultado real (`/health` con base de datos arriba).
- Restaurar la versión anterior si la verificación falla.
- No mover secretos ni datos fuera del VPS.

## No objetivos

- No hay servicio de CI (GitHub/GitLab) ni runners.
- No hay despliegue sin caída (una sola instancia, `pm2 reload`).
- No se revierte la base de datos automáticamente.
- No se toca Docker ni `docker-compose.yml`.

## Anti-objetivos

- Guardar `.env`, llaves o contraseñas en el repositorio.
- Publicar sin que el build de backend y frontend compile.
- Dejar la producción caída tras un fallo de verificación.

## Restricciones

- VPS Ubuntu ya listo: Node 22, PostgreSQL, Nginx, PM2.
- App en `/opt/inventario`, backend en `127.0.0.1:3000`, Nginx sirve
  `frontend/dist` y hace proxy de `/api`, `/uploads` y `/health`.
- Windows local con OpenSSH 8.1, `scp`, `bsdtar` y Git; sin WSL.
- Prisma ya tiene migraciones versionadas en `prisma/migrations`.
- `.env` y `uploads/` viven solo en el VPS.

## Enfoques considerados

- **A. Repo bare en el VPS + hook `post-receive`.** Push como disparador,
  sin servicios externos. Descartado por elección del usuario: exige
  manejar Git en el servidor y no hay visibilidad del despliegue.
- **B. GitHub/GitLab + runner por SSH.** Estándar, con logs y checks.
  Descartado por elección del usuario: agrega un tercero y más piezas.
- **C. Script local `deploy.ps1` sobre SSH/SCP.** *(elegido)* Máximo
  resultado con las piezas que ya existen; no requiere cuentas nuevas.

## Cómo funciona (decidido)

1. `scripts/deploy.ps1` lee `scripts/deploy.config.ps1` (ignorado por Git)
   con host, usuario, puerto, `AppDir`, nombre de PM2 y URL pública.
2. Verifica conexión SSH y que el VPS tenga `node`, `npm`, `pm2`, `curl`
   y el `.env` de producción.
3. Empaqueta el código con `tar` excluyendo `node_modules`, `dist`,
   `frontend/dist`, `.env`, `uploads`, `.git` y logs.
4. Sube el paquete por `scp` a `/tmp`.
5. En el VPS ejecuta `scripts/deploy-remote.sh` (viaja dentro del paquete):
   - respalda `dist`, `frontend/dist` y hace `pg_dump` con marca de tiempo;
   - extrae el código sobre `AppDir` sin tocar `.env` ni `uploads`;
   - `npm ci --include=dev && npm run build`;
   - `cd frontend && npm ci && npm run build`;
   - `npx prisma migrate deploy`;
   - `pm2 reload <app> --update-env`;
   - espera hasta 30 s a que `http://127.0.0.1:3000/health` responda
     `"database":"up"` y, si hay URL pública, la prueba también.
6. Si la verificación falla: restaura los `dist` anteriores, reinicia PM2,
   deja el dump de la base y termina con código de error.
7. Rota respaldos: conserva los últimos 3.

## Decisiones tomadas por mí

- **PowerShell** en lugar de bash en Windows: no hace falta WSL.
- **`scp` de un tarball** en lugar de `rsync`: `rsync` no viene en Windows.
- **Compilar en el VPS**, no en local: artefactos Linux y una sola fuente
  de verdad; el costo es CPU del servidor.
- **`prisma migrate deploy`** en lugar de `db push --accept-data-loss`:
  cambios de esquema revisables y sin pérdida silenciosa de datos.
- **Respaldos en el VPS** (`/opt/inventario/backups`) con rotación.
- **Un solo script remoto** que hace todo y devuelve código de salida, para
  que el script local solo muestre resultado.

## Pendiente del lado humano (una sola vez)

- Crear `scripts/deploy.config.ps1` con los datos reales del VPS.
- Confirmar el nombre del proceso PM2.
- Si la base de producción se creó con `db push`, hacer *baseline*:
  `npx prisma migrate resolve --applied <primera_migracion>`.

## Criterios de aceptación

- `.\scripts\deploy.ps1` publica y termina en verde desde un árbol limpio.
- Si el build falla, producción sigue sirviendo la versión anterior.
- Si `/health` falla tras recargar, se restaura la versión anterior y el
  script sale con error.
- Dos ejecuciones seguidas no rompen nada.
- Ningún secreto queda en el repositorio.
- `DEPLOY.md` documenta el nuevo flujo.
