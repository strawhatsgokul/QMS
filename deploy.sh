#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }

cleanup() {
  if [ $? -ne 0 ]; then
    err "Deployment failed. Check 'docker compose logs' for details."
  fi
}
trap cleanup EXIT

info "=== QMS Dashboard Deployment ==="

# --------------------------------------------------
# 1. Check Docker
# --------------------------------------------------
info "Checking prerequisites..."

if ! command -v docker &>/dev/null; then
  err "Docker is not installed or not in PATH."
  err "Install Docker first: https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  err "Docker Compose (v2) plugin is not available."
  err "Install it: https://docs.docker.com/compose/install/"
  exit 1
fi

ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
ok "Compose $(docker compose version --short)"

# --------------------------------------------------
# 2. Create data directory
# --------------------------------------------------
mkdir -p ./data
ok "Data directory: ./data"

# --------------------------------------------------
# 3. Generate .env with secrets
# --------------------------------------------------
if [ ! -f .env ]; then
  info "Generating .env with secure JWT_SECRET..."

  if command -v openssl &>/dev/null; then
    JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  elif command -v uuidgen &>/dev/null; then
    JWT_SECRET="qs-$(uuidgen)-$(date +%s | sha256sum | base64 | head -c 32)"
  else
    JWT_SECRET="qs-$(head -c 64 /dev/urandom | base64 | tr -d '\n' 2>/dev/null || date +%s%N | sha256sum | base64 | head -c 48)"
  fi

  cat > .env <<EOF
JWT_SECRET=${JWT_SECRET}
DATABASE_URL=file:./data/qms.db?connection_limit=10&journal_mode=WAL
NODE_ENV=production
EOF

  ok ".env created with a random JWT_SECRET"
else
  info ".env already exists, using existing values"
fi

# --------------------------------------------------
# 4. Install dependencies (ensures package-lock.json)
# --------------------------------------------------
info "Installing dependencies to update lockfile..."
npm install --silent --no-audit --no-fund
ok "Dependencies installed"

# --------------------------------------------------
# 5. Deploy with Docker Compose
# --------------------------------------------------
info "Building images and starting containers..."
docker compose up -d --build
ok "Containers started"

# --------------------------------------------------
# 6. Health check
# --------------------------------------------------
info "Waiting for services to be ready..."
sleep 10

HEALTH_URL="http://localhost/api/health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" --max-time 10 || true)

if [ "${HTTP_CODE}" = "200" ]; then
  ok "Health check passed (${HEALTH_URL} → ${HTTP_CODE})"

  SERVER_IP=$(ip -4 addr show scope global 2>/dev/null \
    | grep -oP 'inet \K[\d.]+' \
    | head -1 || true)

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  Dashboard is live at:${NC}"
  echo -e "${GREEN}    http://localhost${NC}"
  if [ -n "${SERVER_IP}" ]; then
    echo -e "${GREEN}    http://${SERVER_IP}${NC}"
  fi
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
  warn "Health check returned HTTP ${HTTP_CODE}. Checking container status..."

  docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

  echo ""
  warn "Services may still be starting up. Try:"
  warn "  docker compose logs --tail=50"
  warn "  curl -s ${HEALTH_URL}"
fi
