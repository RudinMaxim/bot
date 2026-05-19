#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="${DOMAIN:-turni.ru}"
REPO_URL="${REPO_URL:-https://github.com/RudinMaxim/bot.git}"
APP_DIR="${APP_DIR:-/opt/pgmu/bot}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.turni.yml}"
REFRESH_LOCALE="${REFRESH_LOCALE:-ru}"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
DOCKER="$SUDO docker"

cd "$APP_DIR"

if [ ! -d .git ]; then
  echo "ERROR: $APP_DIR is not a git repository" >&2
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: $APP_DIR/$COMPOSE_FILE not found. Run deploy-turni.sh first." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "ERROR: $APP_DIR/.env not found. Run deploy-turni.sh first." >&2
  exit 1
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "ERROR: tracked files have local changes. Commit/stash them before update:" >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" = "HEAD" ]; then
  echo "ERROR: repository is in detached HEAD state" >&2
  exit 1
fi

OLD_REV="$(git rev-parse --short HEAD)"

echo "==> Fetch and pull latest code"
git remote set-url origin "$REPO_URL"
git fetch origin "$CURRENT_BRANCH"
git pull --ff-only origin "$CURRENT_BRANCH"

NEW_REV="$(git rev-parse --short HEAD)"
echo "==> Revision: $OLD_REV -> $NEW_REV"

echo "==> Build and restart services"
$DOCKER compose -f "$COMPOSE_FILE" up -d --build

echo "==> Wait for Postgres"
until $DOCKER compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d developer-ai >/dev/null 2>&1; do
  sleep 3
done

echo "==> Wait for NestJS container"
until $DOCKER compose -f "$COMPOSE_FILE" exec -T nestjs node -v >/dev/null 2>&1; do
  sleep 3
done

echo "==> Run migrations"
$DOCKER compose -f "$COMPOSE_FILE" exec -T nestjs npm run db:migrate

echo "==> Run seed"
$DOCKER compose -f "$COMPOSE_FILE" exec -T nestjs npm run db:seed

echo "==> Refresh search-base index"
$DOCKER compose -f "$COMPOSE_FILE" exec -T nestjs node dist/scripts/search-base-refresh.js --force --locale="$REFRESH_LOCALE"

echo "==> Wait for local health"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:3500/api/health/live" >/dev/null; then
    break
  fi
  sleep 3
done
curl -fsS "http://127.0.0.1:3500/api/health/live" >/dev/null

echo "==> Check public widget"
curl -fsSI "https://${DOMAIN}/api/v1/messaging/widget.js" >/dev/null

echo "==> Compose status"
$DOCKER compose -f "$COMPOSE_FILE" ps

echo
echo "Update finished."
echo "Revision: $OLD_REV -> $NEW_REV"
echo "Widget URL: https://${DOMAIN}/api/v1/messaging/widget.js"
