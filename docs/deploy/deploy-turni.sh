#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="turni.ru"
SERVER_IP="95.163.227.235"
REPO_URL="https://github.com/RudinMaxim/bot.git"
BASE_DIR="/opt/pgmu"
APP_DIR="$BASE_DIR/bot"
COMPOSE_FILE="docker-compose.turni.yml"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
DEPLOY_USER="${SUDO_USER:-$USER}"

echo "==> Base packages"
$SUDO apt-get update
$SUDO apt-get install -y ca-certificates curl git ufw nano nginx certbot python3-certbot-nginx openssl

echo "==> Timezone and firewall"
$SUDO timedatectl set-timezone Asia/Yekaterinburg || true
$SUDO ufw allow OpenSSH
$SUDO ufw allow 80/tcp
$SUDO ufw allow 443/tcp
$SUDO ufw --force enable

echo "==> Docker install/check"
if ! command -v docker >/dev/null 2>&1; then
  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO tee /etc/apt/keyrings/docker.asc >/dev/null
  $SUDO chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  CODENAME="${UBUNTU_CODENAME:-$VERSION_CODENAME}"
  ARCH="$(dpkg --print-architecture)"
  $SUDO tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${CODENAME}
Components: stable
Architectures: ${ARCH}
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  $SUDO apt-get update
  $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

DOCKER="$SUDO docker"

echo "==> Clone/pull repo"
$SUDO mkdir -p "$BASE_DIR"
$SUDO chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$BASE_DIR"

if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" remote set-url origin "$REPO_URL"
  git -C "$APP_DIR" pull --ff-only
elif [ -e "$APP_DIR" ]; then
  echo "ERROR: $APP_DIR exists but is not a git repository" >&2
  exit 1
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

echo "==> Production .env"
EXISTING_OPENROUTER=""
if [ -f .env ]; then
  EXISTING_OPENROUTER="$(grep -E '^OPENROUTER_API_KEY=' .env | cut -d= -f2- || true)"
  cp .env ".env.backup.$(date +%Y%m%d-%H%M%S)"
fi

OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-$EXISTING_OPENROUTER}"
if [ -z "$OPENROUTER_API_KEY" ] || [ "$OPENROUTER_API_KEY" = "sk-or-REPLACE_ME" ]; then
  read -r -p "OPENROUTER_API_KEY: " OPENROUTER_API_KEY
fi

POSTGRES_PASSWORD="$(openssl rand -hex 24)"
REDIS_PASSWORD="$(openssl rand -hex 24)"
SESSION_SIGNING_KEY="$(openssl rand -hex 32)"
JWT_SIGNING_KEY="$(openssl rand -hex 32)"

cat >.env <<EOF
NODE_ENV=production
HOST=0.0.0.0
PORT=3500

SESSION_SIGNING_KEY=${SESSION_SIGNING_KEY}
JWT_SIGNING_KEY=${JWT_SIGNING_KEY}
SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_SAMESITE=none
SESSION_COOKIE_SECURE=true

INTEGRATION_API_KEYS=
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}

POSTGRES_DB=developer-ai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_URL=postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/developer-ai

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_DB=0

CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}

WIDGET_API_BASE=https://${DOMAIN}

EMBEDDING_VECTORIZATION_PROVIDER=ollama
EMBEDDING_VECTORIZATION_MODEL=nomic-embed-text-v2-moe
EMBEDDING_VECTORIZATION_URL=http://ollama:11434
EMBEDDING_DATABASE_PROVIDER=weaviate
EMBEDDING_DATABASE_URL=http://weaviate:8080
EMBEDDING_DATABASE_CLASS_NAME=PsmuKnowledgeEmbeddings
EMBEDDING_DATABASE_API_KEY=

SWAGGER_ENABLED=false
INSTALL_PLAYWRIGHT_BROWSER=false
EOF
chmod 600 .env

echo "==> VPS compose file"
cat >"$COMPOSE_FILE" <<EOF
services:
  weaviate:
    image: semitechnologies/weaviate:1.25.0
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
      - "127.0.0.1:50051:50051"
    environment:
      QUERY_DEFAULTS_LIMIT: "25"
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: "true"
      PERSISTENCE_DATA_PATH: /var/lib/weaviate
      DEFAULT_VECTORIZER_MODULE: none
      ENABLE_MODULES: text2vec-cohere,text2vec-huggingface,text2vec-palm,generative-cohere,generative-palm,ref2vec-centroid,reranker-cohere
      ENABLE_GRPC: "true"
      CLUSTER_HOSTNAME: node1
      REPLICATION_FACTOR: "1"
      CLUSTER_GOSSIP_BIND_PORT: "7100"
      CLUSTER_DATA_BIND_PORT: "7101"
      CLUSTER_JOIN: ""
    volumes:
      - weaviate_data:/var/lib/weaviate
    networks:
      - app_network

  ollama:
    image: ollama/ollama:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:11434:11434"
    environment:
      OLLAMA_HOST: 0.0.0.0
      OLLAMA_ORIGINS: "*"
      OLLAMA_KEEP_ALIVE: "-1"
      OLLAMA_NUM_PARALLEL: "1"
      OLLAMA_MAX_QUEUE: "128"
    volumes:
      - ollama_data:/root/.ollama
    networks:
      - app_network
    entrypoint: >
      sh -c "
        ollama serve &
        sleep 5 &&
        ollama pull \${OLLAMA_MODELS:-nomic-embed-text-v2-moe:latest}
        wait
      "

  redis:
    image: redis:latest
    restart: unless-stopped
    env_file:
      - .env
    command: >
      sh -c 'redis-server --appendonly yes --requirepass "\$\$REDIS_PASSWORD"'
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - app_network

  postgres:
    image: postgres:16
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d developer-ai"]
      interval: 5s
      timeout: 5s
      retries: 20

  nestjs:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - .env
    environment:
      HOST: 0.0.0.0
      PORT: 3500
      POSTGRES_URL: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/developer-ai
      REDIS_HOST: redis
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      EMBEDDING_DATABASE_URL: http://weaviate:8080
      EMBEDDING_DATABASE_CLASS_NAME: PsmuKnowledgeEmbeddings
      EMBEDDING_VECTORIZATION_URL: http://ollama:11434
      SESSION_COOKIE_DOMAIN: ""
      SESSION_COOKIE_SAMESITE: none
      SESSION_COOKIE_SECURE: "true"
      CORS_ORIGINS: https://${DOMAIN},https://www.${DOMAIN}
    ports:
      - "127.0.0.1:3500:3500"
    depends_on:
      - weaviate
      - ollama
      - postgres
      - redis
    networks:
      - app_network

volumes:
  weaviate_data:
  ollama_data:
  redis_data:
  postgres_data:

networks:
  app_network:
    driver: bridge
EOF

echo "==> Build and start"
$DOCKER compose -f "$COMPOSE_FILE" up -d --build

echo "==> Wait for Postgres"
until $DOCKER compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d developer-ai >/dev/null 2>&1; do
  sleep 3
done

echo "==> Wait for Ollama model"
for i in $(seq 1 90); do
  if $DOCKER compose -f "$COMPOSE_FILE" exec -T ollama ollama list 2>/dev/null | grep -q "nomic-embed-text-v2-moe"; then
    break
  fi
  sleep 10
done

echo "==> Migrate, seed, refresh search-base"
$DOCKER compose -f "$COMPOSE_FILE" exec -T nestjs npm run db:migrate
$DOCKER compose -f "$COMPOSE_FILE" exec -T nestjs npm run db:seed
$DOCKER compose -f "$COMPOSE_FILE" exec -T nestjs node dist/scripts/search-base-refresh.js --force --locale=ru

echo "==> Nginx reverse proxy"
$SUDO tee "/etc/nginx/sites-available/$DOMAIN" >/dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3500;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

$SUDO ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
$SUDO nginx -t
$SUDO systemctl reload nginx

RESOLVED_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1 {print $1}')"
if [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
  echo "WARNING: $DOMAIN resolves to '$RESOLVED_IP', expected '$SERVER_IP'. Certbot may fail."
fi

EMAIL="${LETSENCRYPT_EMAIL:-admin@$DOMAIN}"
read -r -p "Let's Encrypt email [$EMAIL]: " EMAIL_INPUT
EMAIL="${EMAIL_INPUT:-$EMAIL}"

echo "==> TLS certificate"
$SUDO certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect

echo "==> Health checks"
curl -fsS "http://127.0.0.1:3500/api/health/live" >/dev/null
curl -fsS "https://${DOMAIN}/api/health/live" >/dev/null
curl -fsSI "https://${DOMAIN}/api/v1/messaging/widget.js" >/dev/null
$DOCKER compose -f "$COMPOSE_FILE" ps

echo
echo "Deploy finished."
echo "Widget URL: https://${DOMAIN}/api/v1/messaging/widget.js"
echo "App dir: $APP_DIR"
echo "Compose: docker compose -f $APP_DIR/$COMPOSE_FILE ps"
