#!/usr/bin/env bash
# Diagnóstico de despliegue sin Docker para Inventario Rápido.
# Uso:
#   bash scripts/diagnostico.sh
#   bash scripts/diagnostico.sh --fix
#   BACKEND_PORT=3000 PUBLIC_PORT=55896 TEST_PASSWORD="tu-password" bash scripts/diagnostico.sh

set -uo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
PUBLIC_PORT="${PUBLIC_PORT:-55896}"
API_URL="${API_URL:-http://127.0.0.1:${BACKEND_PORT}}"
PUBLIC_URL="${PUBLIC_URL:-http://127.0.0.1:${PUBLIC_PORT}}"
TMP_DIR="${TMPDIR:-/tmp}/inventario-diag-$$"
FIX=0
[ "${1:-}" = "--fix" ] && FIX=1

mkdir -p "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

if [ -t 1 ]; then
  RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; BLUE="\033[34m"; NC="\033[0m"
else
  RED=""; GREEN=""; YELLOW=""; BLUE=""; NC=""
fi

PASS=0; FAIL=0; WARN=0
pass() { PASS=$((PASS + 1)); printf "${GREEN}[OK]${NC} %s\n" "$*"; }
fail() { FAIL=$((FAIL + 1)); printf "${RED}[FALLA]${NC} %s\n" "$*"; }
warn() { WARN=$((WARN + 1)); printf "${YELLOW}[AVISO]${NC} %s\n" "$*"; }
info() { printf "${BLUE}[INFO]${NC} %s\n" "$*"; }
section() { printf "\n${BLUE}== %s ==${NC}\n" "$*"; }
suggest() { printf "       ${YELLOW}→ Corrección sugerida:${NC} %s\n" "$*"; }
fix_or_suggest() {
  if [ "$FIX" -eq 1 ]; then
    info "Ejecutando: $*"
    bash -c "$*" || warn "No se pudo ejecutar: $*"
  else
    suggest "$*"
  fi
}

http_get() {
  local url="$1" out="$2" code
  if code="$(curl -sS --max-time 5 -o "$out" -w "%{http_code}" "$url" 2>/dev/null)"; then
    printf '%s' "$code"
  else
    printf '000'
  fi
}

http_post_json() {
  local url="$1" out="$2" data="$3" code
  if code="$(curl -sS --max-time 8 -o "$out" -w "%{http_code}" \
    -X POST "$url" -H "Content-Type: application/json" -d "$data" 2>/dev/null)"; then
    printf '%s' "$code"
  else
    printf '000'
  fi
}

section "Entorno"
info "Directorio del proyecto: $APP_DIR"
info "Backend directo: $API_URL"
info "Aplicación pública: $PUBLIC_URL"
info "Usuario: $(whoami)"

if [ -f "$APP_DIR/package.json" ]; then
  pass "package.json encontrado"
else
  fail "No se encontró $APP_DIR/package.json"
  suggest "Verifica APP_DIR o ejecuta el script desde la raíz del proyecto."
fi

section "Node.js / npm"
if command -v node >/dev/null 2>&1; then
  NODE_VERSION="$(node -v 2>/dev/null)"
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  pass "Node.js instalado: $NODE_VERSION"
  if [ "${NODE_MAJOR:-0}" -lt 22 ]; then
    warn "Se recomienda Node.js 22 o superior (el proyecto usa Vite 8 y Drizzle)."
    suggest "nvm install 22 && nvm use 22"
  fi
else
  fail "Node.js no está instalado o no está en PATH"
  suggest "Instala Node 22 con nvm o NodeSource."
fi

if command -v npm >/dev/null 2>&1; then
  pass "npm instalado: $(npm -v)"
else
  fail "npm no está instalado"
  suggest "Instala Node.js 22; incluye npm."
fi

section "Archivos y configuración"
if [ -f "$APP_DIR/.env" ]; then
  pass ".env encontrado"
  for key in DATABASE_URL JWT_SECRET; do
    if grep -qE "^${key}=." "$APP_DIR/.env"; then
      pass "$key definido en .env"
    else
      fail "$key no está definido en .env"
      suggest "Agrega $key=... en $APP_DIR/.env"
    fi
  done
  if grep -qE '^ADMIN_PASSWORD=.' "$APP_DIR/.env"; then
    pass "ADMIN_PASSWORD definido en .env"
  else
    warn "ADMIN_PASSWORD no está definido (solo se usa en el primer arranque con BD vacía)"
    suggest "Si la BD está vacía, agrega ADMIN_PASSWORD=... en $APP_DIR/.env"
  fi
  JWT_VALUE="$(grep -E '^JWT_SECRET=' "$APP_DIR/.env" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  if [ "${#JWT_VALUE}" -ge 32 ]; then
    pass "JWT_SECRET tiene longitud suficiente"
  else
    warn "JWT_SECRET es corto; en producción debe tener 32+ caracteres."
    suggest "Genera uno con: openssl rand -hex 32"
  fi
else
  fail "No existe $APP_DIR/.env"
  suggest "cp .env.example .env && nano .env"
fi

if [ -d "$APP_DIR/node_modules/typescript" ] && [ -d "$APP_DIR/node_modules/@types/node" ]; then
  pass "Dependencias de desarrollo para compilar están instaladas"
else
  fail "Faltan dependencias de desarrollo (typescript y/o @types/node)"
  suggest "cd $APP_DIR && npm ci --include=dev && npm run build"
fi

if [ -f "$APP_DIR/dist/index.js" ]; then
  pass "Backend compilado (dist/index.js) encontrado"
else
  warn "No existe dist/index.js"
  suggest "cd $APP_DIR && npm ci --include=dev && npm run build"
fi

if [ -f "$APP_DIR/frontend/dist/index.html" ]; then
  pass "Frontend compilado (frontend/dist) encontrado"
else
  fail "No existe frontend/dist/index.html"
  suggest "cd $APP_DIR/frontend && npm ci && npm run build"
fi

section "Backend"
BACKEND_HTTP="000"
if command -v curl >/dev/null 2>&1; then
  BACKEND_HTTP="$(http_get "$API_URL/health" "$TMP_DIR/health.json")"
else
  fail "curl no está instalado; no se puede probar el backend"
  suggest "sudo apt install -y curl"
fi

if [ "$BACKEND_HTTP" = "200" ]; then
  pass "Backend responde en $API_URL/health"
  if grep -q '"database":"up"' "$TMP_DIR/health.json" 2>/dev/null; then
    pass "Base de datos conectada (database=up)"
  else
    fail "El backend responde, pero la base de datos no está disponible"
    cat "$TMP_DIR/health.json" 2>/dev/null || true
    suggest "Revisa DATABASE_URL, que PostgreSQL esté activo y que las credenciales sean correctas."
  fi
elif [ "$BACKEND_HTTP" = "503" ]; then
  fail "Backend activo, pero la base de datos falla (HTTP 503)"
  cat "$TMP_DIR/health.json" 2>/dev/null || true
  suggest "sudo systemctl status postgresql && psql \"\$DATABASE_URL\" -c 'SELECT 1'"
else
  fail "No hay respuesta del backend en $API_URL/health (HTTP $BACKEND_HTTP)"
  [ -s "$TMP_DIR/curl.err" ] && cat "$TMP_DIR/curl.err"
  suggest "Verifica que el backend esté corriendo: pm2 status / pm2 restart inventario-api"
  suggest "Revisa el puerto en .env y que no esté ocupado: ss -ltnp | grep :$BACKEND_PORT"
fi

if command -v ss >/dev/null 2>&1; then
  if ss -ltn 2>/dev/null | grep -qE "[:.]${BACKEND_PORT}[[:space:]]"; then
    pass "Puerto $BACKEND_PORT escuchando"
  else
    warn "No se detecta el puerto $BACKEND_PORT escuchando"
    suggest "ss -ltnp | grep :$BACKEND_PORT"
  fi
else
  warn "ss no disponible; no se pudo verificar el puerto $BACKEND_PORT"
fi

if command -v psql >/dev/null 2>&1 && [ -f "$APP_DIR/.env" ]; then
  DB_URL="$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  if [ -n "$DB_URL" ]; then
    if PGCONNECT_TIMEOUT=5 psql "$DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
      pass "Conexión directa a PostgreSQL correcta"
    else
      fail "psql no pudo conectarse usando DATABASE_URL"
      suggest "Revisa usuario/contraseña, host, puerto y que PostgreSQL esté iniciado."
    fi
  fi
else
  warn "psql no disponible; se omite la prueba directa de PostgreSQL"
fi

section "Nginx"
NGINX_ACTIVE="unknown"
if command -v systemctl >/dev/null 2>&1; then
  NGINX_ACTIVE="$(systemctl is-active nginx 2>/dev/null || true)"
  if [ "$NGINX_ACTIVE" = "active" ]; then
    pass "Servicio nginx activo"
  else
    fail "Servicio nginx no activo ($NGINX_ACTIVE)"
    fix_or_suggest "sudo systemctl start nginx && sudo systemctl enable nginx"
  fi
else
  warn "systemctl no disponible; no se pudo comprobar el servicio nginx"
fi

if command -v nginx >/dev/null 2>&1; then
  if nginx -t >/dev/null 2>&1; then
    pass "Configuración de Nginx válida (nginx -t)"
  elif sudo -n nginx -t >/dev/null 2>&1; then
    pass "Configuración de Nginx válida (con sudo)"
  else
    fail "La configuración de Nginx tiene errores"
    nginx -t 2>&1 | tail -n 10 || true
    suggest "Corrige el archivo de sitio y ejecuta: sudo nginx -t"
  fi
else
  warn "nginx no está instalado o no está en PATH"
fi

if command -v ss >/dev/null 2>&1; then
  if ss -ltn 2>/dev/null | grep -qE "[:.]${PUBLIC_PORT}[[:space:]]"; then
    pass "Puerto público $PUBLIC_PORT escuchando"
  else
    fail "Nginx no está escuchando en el puerto $PUBLIC_PORT"
    suggest "Revisa 'listen $PUBLIC_PORT;' en tu configuración de Nginx."
  fi
fi

NGINX_FILES="$(grep -RIl "proxy_pass.*${BACKEND_PORT}" /etc/nginx/sites-enabled /etc/nginx/conf.d /etc/nginx/nginx.conf 2>/dev/null || true)"
if [ -n "$NGINX_FILES" ]; then
  pass "Se encontró proxy_pass al backend en: $(echo "$NGINX_FILES" | tr '\n' ' ')"
else
  fail "No se encontró proxy_pass hacia el puerto $BACKEND_PORT en Nginx"
  suggest "Agrega location /api/, /uploads/ y /health apuntando a http://127.0.0.1:$BACKEND_PORT"
fi

section "Pruebas a través de Nginx"
if command -v curl >/dev/null 2>&1; then
  INDEX_HTTP="$(http_get "$PUBLIC_URL/" "$TMP_DIR/index.html")"
  if [ "$INDEX_HTTP" = "200" ] && grep -qi "<html" "$TMP_DIR/index.html"; then
    pass "Frontend servido por Nginx ($PUBLIC_URL)"
  else
    fail "Nginx no está sirviendo el frontend correctamente (HTTP $INDEX_HTTP)"
    suggest "Verifica root /opt/inventario/frontend/dist y el try_files de SPA."
  fi

  PUBLIC_HEALTH_HTTP="$(http_get "$PUBLIC_URL/api/health" "$TMP_DIR/public-health.json")"
  if [ "$PUBLIC_HEALTH_HTTP" = "200" ] && grep -q '"database":"up"' "$TMP_DIR/public-health.json" 2>/dev/null; then
    pass "API y base de datos accesibles a través de Nginx (/api/health)"
  elif [ "$PUBLIC_HEALTH_HTTP" = "503" ]; then
    fail "Nginx llega al backend, pero la base de datos falla (503)"
    cat "$TMP_DIR/public-health.json" 2>/dev/null || true
    suggest "Revisa DATABASE_URL y el servicio de PostgreSQL."
  else
    fail "Nginx no puede acceder al backend en /api/health (HTTP $PUBLIC_HEALTH_HTTP)"
    head -c 300 "$TMP_DIR/public-health.json" 2>/dev/null || true
    suggest "Falta el proxy de /api/ en Nginx o el backend no está en 127.0.0.1:$BACKEND_PORT."
  fi

  if [ -n "${TEST_PASSWORD:-}" ]; then
    ESCAPED_PASSWORD="$(printf '%s' "$TEST_PASSWORD" | sed 's/\\/\\\\/g; s/"/\\"/g')"
    LOGIN_HTTP="$(http_post_json "$PUBLIC_URL/api/auth/login" "$TMP_DIR/login.json" "{\"password\":\"$ESCAPED_PASSWORD\"}")"
    case "$LOGIN_HTTP" in
      200) pass "Login de prueba correcto a través de Nginx" ;;
      401) warn "Login responde 401: la contraseña de prueba es incorrecta" ;;
      429) fail "Login bloqueado por demasiados intentos (429)"
           suggest "Espera el tiempo de bloqueo o limpia la tabla LoginAttempt." ;;
      000) fail "No se pudo conectar al login a través de Nginx"
           suggest "Revisa Nginx, firewall y que /api/ esté proxificado." ;;
      *)   fail "Login devolvió HTTP $LOGIN_HTTP"
           head -c 300 "$TMP_DIR/login.json" 2>/dev/null || true ;;
    esac
  else
    info "Para probar el login, ejecuta: TEST_PASSWORD='tu-password' bash scripts/diagnostico.sh"
  fi
fi

section "Build del frontend"
if grep -R -q "localhost:3000" "$APP_DIR/frontend/dist/assets" 2>/dev/null; then
  warn "El build del frontend contiene referencias a localhost:3000"
  suggest "Revisa frontend/.env.production (VITE_API_BASE=) y vuelve a ejecutar npm run build."
else
  pass "El build del frontend usa rutas relativas"
fi

section "Archivos subidos"
if [ -d "$APP_DIR/uploads" ]; then
  if [ -w "$APP_DIR/uploads" ]; then
    pass "Directorio uploads existe y es escribible"
  else
    fail "El directorio uploads no es escribible"
    fix_or_suggest "sudo chmod 775 $APP_DIR/uploads && sudo chown $(whoami):$(id -gn) $APP_DIR/uploads"
  fi
else
  fail "No existe el directorio uploads"
  fix_or_suggest "mkdir -p $APP_DIR/uploads && chmod 775 $APP_DIR/uploads"
fi

section "Registros recientes"
if [ -f /var/log/nginx/error.log ]; then
  info "Últimas líneas de /var/log/nginx/error.log:"
  tail -n 8 /var/log/nginx/error.log 2>/dev/null || true
fi

if command -v pm2 >/dev/null 2>&1; then
  info "Estado de PM2:"
  pm2 list 2>/dev/null | sed -n '1,20p' || true
fi

section "Resumen"
printf "OK: %s   AVISOS: %s   FALLAS: %s\n" "$PASS" "$WARN" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  printf "\n${RED}Hay problemas que impiden el funcionamiento correcto.${NC}\n"
  printf "Revisa las correcciones sugeridas arriba.\n"
  exit 1
fi

printf "\n${GREEN}No se detectaron fallas críticas.${NC}\n"
exit 0
