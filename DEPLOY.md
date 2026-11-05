# Despliegue rápido con Docker

Esta es la forma más sencilla de desplegar la aplicación completa (frontend, backend y PostgreSQL) en un servidor o en tu equipo.

## Requisitos

- Docker Engine + Docker Compose (o Docker Desktop en Windows/Mac).
- Puerto 55896 libre (o cambia el puerto en `docker-compose.yml`).

## Pasos

1. Copia el proyecto al servidor.
2. Crea el archivo `.env` a partir del ejemplo:

```bash
cp .env.docker.example .env
```

Edita `.env` y sustituye obligatoriamente:
- `APP_PORT` (por defecto `55896`)
- `POSTGRES_PASSWORD`
- `JWT_SECRET` (usa una cadena larga y aleatoria)
- `ADMIN_PASSWORD` (contraseña inicial del administrador)

El Compose falla intencionadamente si faltan los tres secretos. No publiques `.env`.

3. Construye y levanta todo:

```bash
docker compose up -d --build
```

Espera los estados `healthy` de PostgreSQL, backend y frontend (`docker compose ps`). El backend aplica únicamente migraciones Drizzle versionadas al iniciar.

4. Abre la aplicación:

```
http://localhost:55896
# o http://IP_DEL_SERVIDOR:55896
```

5. Inicia sesión con la contraseña definida en `ADMIN_PASSWORD`.
   El usuario `admin` se crea automáticamente solo si la base de datos está vacía.

## Comandos útiles

```bash
docker compose ps                 # estado de los servicios
docker compose logs -f backend    # logs del backend
docker compose logs -f frontend   # logs de nginx
docker compose restart            # reiniciar
docker compose down               # detener (los datos se conservan en volúmenes)
docker compose up -d --build      # actualizar tras cambios
```

## Backup y restauración PostgreSQL

```bash
docker compose exec -T db pg_dump -U postgres -d inventario -Fc > inventario.dump
# Restaurar reemplaza toda la base destino: respalda primero y verifica el proyecto.
docker compose stop backend
docker compose exec db dropdb -U postgres --if-exists inventario
docker compose exec db createdb -U postgres inventario
docker compose exec -T db pg_restore -U postgres -d inventario --no-owner < inventario.dump
docker compose up -d backend
```

El volumen `uploads` requiere respaldo independiente. Nunca uses `down -v` para conservar datos.

## Datos persistentes

- Base de datos: volumen `pgdata`.
- Archivos de constancias: volumen `uploads`.

No borres estos volúmenes si quieres conservar la información.

## Respaldos

- Desde la app: **Configuración → Respaldos → Descargar respaldo JSON**.
- Respaldo manual de PostgreSQL:

```bash
docker compose exec db pg_dump -U postgres inventario > respaldo.sql
```

## Recomendaciones de seguridad

- Cambia `ADMIN_PASSWORD` y `JWT_SECRET` antes de publicar.
- Usa HTTPS (por ejemplo, con Caddy o Nginx + Let's Encrypt).
- No expongas PostgreSQL al público; solo los puertos 55896 y 443 (HTTPS).
- Programa respaldos periódicos.
- Define `CORS_ORIGIN` con tu dominio real si la API se consume desde otro origen.
- La app ya incluye Helmet, rate limiting, política de contraseñas y validación de archivos.
- Si la app crece, usa PostgreSQL administrado y escala el backend con un balanceador.

## Alternativa sin Docker

También puedes desplegar en un VPS:

1. Instalar Node.js 22, PostgreSQL y Nginx.
2. Backend: `npm ci --include=dev && npm run build && node dist/index.js`.
3. Frontend: `cd frontend && npm ci --include=dev && npm run build`.

> Importante: para compilar con TypeScript necesitas las dependencias de desarrollo (`typescript`, `@types/node`, `drizzle-kit`). No uses `npm ci --omit=dev` antes de `npm run build`. Si quieres reducir el runtime, ejecuta `npm prune --omit=dev` **después** de compilar. Prisma fue retirado del runtime, las herramientas y el script de rendimiento.
4. Servir `frontend/dist` con Nginx y redirigir `/api` y `/uploads` al backend.
5. Usar PM2 o systemd para mantener el backend activo.

Para muchas personas, el despliegue con Docker Compose es el más reproducible.

## Diagnóstico de problemas

Si Nginx funciona pero el login falla, ejecuta:

```bash
bash scripts/diagnostico.sh
# o probando también el login:
TEST_PASSWORD="tu-password" bash scripts/diagnostico.sh
```

El script revisa Node, `.env`, backend, PostgreSQL, Nginx, proxies, puertos, build del frontend, archivos subidos y muestra correcciones sugeridas. Con `--fix` aplica correcciones seguras.

## Nginx para despliegue sin Docker

```nginx
server {
    listen 55896;
    server_name _;

    root /opt/inventario/frontend/dist;
    index index.html;
    client_max_body_size 50m;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location = /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Después:

```bash
sudo nginx -t
sudo systemctl restart nginx
```
