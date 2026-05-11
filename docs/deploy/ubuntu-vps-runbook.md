# Ubuntu VPS runbook

Ранбук поднимает проект с нуля на чистой Ubuntu VPS через Docker Compose:

- API NestJS на `3500`;
- Postgres, Redis, Weaviate, Ollama;
- сид базы знаний из `resources`;
- refresh векторного индекса для search-base;
- script-widget `/api/v1/messaging/widget.js`.

Команды ниже рассчитаны на Ubuntu 22.04/24.04 LTS и запуск под пользователем с `sudo`.

## 0. Что подготовить

Нужно заранее иметь:

- домен или поддомен, например `chat.example.ru`;
- SSH-доступ на VPS;
- `OPENROUTER_API_KEY`;
- репозиторий проекта или архив проекта на сервере;
- минимум 4 CPU / 8 GB RAM для комфортной работы Ollama + Weaviate. Для слабой VPS будет работать медленно.

Порты:

- наружу: `22`, `80`, `443`, временно можно `3500`;
- не открывать публично без необходимости: `5432`, `6379`, `8080`, `11434`.

Важно: Docker publish ports может обходить `ufw`. Если VPS-провайдер дает cloud firewall/security group, закрывайте там все, кроме `22/80/443` и временного `3500`.

## 1. Базовая подготовка Ubuntu

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw nano
sudo timedatectl set-timezone Asia/Yekaterinburg
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3500/tcp
sudo ufw --force enable
sudo ufw status
```

После настройки reverse proxy порт `3500` лучше закрыть:

```bash
sudo ufw delete allow 3500/tcp
```

## 2. Установка Docker Engine и Compose plugin

Официальный способ Docker для Ubuntu через `apt` repository:

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Проверка:

```bash
sudo docker version
sudo docker compose version
```

Чтобы запускать Docker без `sudo`:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
docker ps
```

## 3. Получить проект на сервер

Вариант через git:

```bash
sudo mkdir -p /opt/pgmu
sudo chown "$USER":"$USER" /opt/pgmu
cd /opt/pgmu
git clone <REPO_URL> bot
cd /opt/pgmu/bot
```

Вариант через архив:

```bash
sudo mkdir -p /opt/pgmu/bot
sudo chown -R "$USER":"$USER" /opt/pgmu
cd /opt/pgmu/bot
# загрузите архив проекта сюда и распакуйте
```

## 4. Создать `.env`

```bash
cd /opt/pgmu/bot
cp .env.example .env
nano .env
```

Минимальный production-набор:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3500

SESSION_SIGNING_KEY=REPLACE_WITH_RANDOM_64_CHARS
JWT_SIGNING_KEY=REPLACE_WITH_ANOTHER_RANDOM_64_CHARS

SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_SAMESITE=none
SESSION_COOKIE_SECURE=true

OPENROUTER_API_KEY=sk-or-REPLACE_ME

POSTGRES_DB=developer-ai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=REPLACE_WITH_STRONG_PASSWORD
POSTGRES_URL=postgres://postgres:REPLACE_WITH_STRONG_PASSWORD@postgres:5432/developer-ai

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=REPLACE_WITH_STRONG_REDIS_PASSWORD
REDIS_DB=0

CORS_ORIGINS=https://psmu.ru,https://www.psmu.ru,https://chat.m-rudin.ru

EMBEDDING_VECTORIZATION_PROVIDER=ollama
EMBEDDING_VECTORIZATION_MODEL=nomic-embed-text-v2-moe
EMBEDDING_VECTORIZATION_URL=http://ollama:11434
EMBEDDING_DATABASE_PROVIDER=weaviate
EMBEDDING_DATABASE_URL=http://weaviate:8080
EMBEDDING_DATABASE_CLASS_NAME=PsmuKnowledgeEmbeddings
EMBEDDING_DATABASE_API_KEY=

SWAGGER_ENABLED=false
INSTALL_PLAYWRIGHT_BROWSER=false
```

Сгенерировать ключи:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Проверьте, что в Docker-окружении не осталось:

```dotenv
EMBEDDING_VECTORIZATION_URL=http://127.0.0.1:11434
EMBEDDING_DATABASE_URL=http://127.0.0.1:8080
REDIS_HOST=127.0.0.1
```

Внутри Compose нужны service names: `ollama`, `weaviate`, `redis`, `postgres`.

## 5. Собрать и запустить сервисы

```bash
cd /opt/pgmu/bot
docker compose -f docker-compose.dev.yml up -d --build
```

Проверить контейнеры:

```bash
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs -f nestjs
```

Дождитесь, пока Ollama скачает модель:

```bash
docker compose -f docker-compose.dev.yml logs -f ollama
```

В логах должно быть, что модель `nomic-embed-text-v2-moe` скачана. Первый запуск может занять несколько минут.

## 6. Миграции, сид и индекс базы знаний

Миграции:

```bash
docker compose -f docker-compose.dev.yml exec -T nestjs npm run db:migrate
```

Сид Postgres:

```bash
docker compose -f docker-compose.dev.yml exec -T nestjs npm run db:seed
```

Ожидаемый смысл вывода:

```text
Seed completed: locales updated=..., global settings=..., search-base upserted=31
```

Refresh векторного индекса Weaviate:

```bash
docker compose -f docker-compose.dev.yml exec -T nestjs node dist/scripts/search-base-refresh.js --force --locale=ru
```

Ожидаемый смысл вывода:

```text
Search-base upsert completed: created=31, updated=0, skipped=0, failed=0
search-base refresh completed (force=true, locale=ru)
```

Если команда говорит `Cannot find module ...dist/scripts/search-base-refresh.js`, значит image собран без compiled scripts. В актуальном Dockerfile `dist/scripts` копируется в runtime image. Пересоберите образ:

```bash
docker compose -f docker-compose.dev.yml up -d --build --force-recreate nestjs
```

Быстрая проверка:

```bash
docker compose -f docker-compose.dev.yml exec -T nestjs ls -la dist/scripts
```

## 7. Health-check

API liveness:

```bash
curl -i http://127.0.0.1:3500/api/health/live
```

API readiness:

```bash
curl -i http://127.0.0.1:3500/api/health/ready
```

Widget JS:

```bash
curl -I http://127.0.0.1:3500/api/v1/messaging/widget.js
```

Widget CSS:

```bash
curl -I http://127.0.0.1:3500/api/v1/messaging/widget.css
```

## 8. Проверка сообщения через API

Создать сессию и сохранить cookie:

```bash
curl -i -c /tmp/pgmu-cookie.txt -X POST http://127.0.0.1:3500/api/v1/messaging/session
```

Ответ вернет `chatId`. Подставьте его:

```bash
CHAT_ID=chat_xxx

curl -i -b /tmp/pgmu-cookie.txt \
  -H "Content-Type: application/json" \
  -X POST http://127.0.0.1:3500/api/v1/messaging/messages \
  -d "{\"chatId\":\"$CHAT_ID\",\"content\":\"Какие виды аккредитации проводит ФАЦ ПГМУ?\",\"locale\":\"ru\"}"
```

Если ответ не использует базу знаний:

```bash
docker compose -f docker-compose.dev.yml logs --since 10m nestjs
docker compose -f docker-compose.dev.yml logs --since 10m ollama
```

Ищите:

- `ollama_embedding_done`;
- `Search completed: ... results`;
- `response_agent completed ... Tokens: input=..., output=...`.

## 9. Вставка виджета на сайт

Минимальный контейнер:

```html
<div id="pgmu-chat" style="width:100%;height:560px"></div>
```

Скрипт:

```html
<script
  src="https://chat.example.ru/api/v1/messaging/widget.js"
  data-container="#pgmu-chat"
  async
></script>
```

Если виджет размещается на `psmu.ru`, в `.env` должен быть CORS:

```dotenv
CORS_ORIGINS=https://psmu.ru,https://www.psmu.ru
```

Для cross-site cookies:

```dotenv
SESSION_COOKIE_SAMESITE=none
SESSION_COOKIE_SECURE=true
```

И сайт должен открываться по HTTPS.

## 10. Reverse proxy через Nginx

Установка:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Конфиг:

```bash
sudo nano /etc/nginx/sites-available/pgmu-chat
```

```nginx
server {
    listen 80;
    server_name chat.example.ru;

    location / {
        proxy_pass http://127.0.0.1:3500;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Включить:

```bash
sudo ln -s /etc/nginx/sites-available/pgmu-chat /etc/nginx/sites-enabled/pgmu-chat
sudo nginx -t
sudo systemctl reload nginx
```

TLS:

```bash
sudo certbot --nginx -d chat.example.ru
```

После TLS:

```bash
curl -i https://chat.example.ru/api/health/live
curl -I https://chat.example.ru/api/v1/messaging/widget.js
```

## 11. Обновление после нового релиза

```bash
cd /opt/pgmu/bot
git pull
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml exec -T nestjs npm run db:migrate
docker compose -f docker-compose.dev.yml exec -T nestjs npm run db:seed
docker compose -f docker-compose.dev.yml exec -T nestjs node dist/scripts/search-base-refresh.js --force --locale=ru
docker compose -f docker-compose.dev.yml ps
```

Если менялся только код без базы знаний, refresh можно не запускать.

## 12. Полезная диагностика

Статус:

```bash
docker compose -f docker-compose.dev.yml ps
```

Логи API:

```bash
docker compose -f docker-compose.dev.yml logs -f nestjs
```

Логи Ollama:

```bash
docker compose -f docker-compose.dev.yml logs -f ollama
```

Проверить модели Ollama:

```bash
docker compose -f docker-compose.dev.yml exec -T ollama ollama list
```

Проверить Postgres:

```bash
docker compose -f docker-compose.dev.yml exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from search_base_catalog;"'
```

Проверить Redis:

```bash
docker compose -f docker-compose.dev.yml exec -T redis redis-cli ping
```

Если Redis с паролем:

```bash
docker compose -f docker-compose.dev.yml exec -T redis sh -c 'redis-cli -a "$REDIS_PASSWORD" ping'
```

Очистить старый query cache ответов:

```bash
docker compose -f docker-compose.dev.yml exec -T redis sh -c \
  'redis-cli --scan --pattern "ai:query-cache:v1:*" | xargs -r redis-cli del'
```

Если Redis с паролем, лучше зайти внутрь:

```bash
docker compose -f docker-compose.dev.yml exec redis sh
redis-cli -a "$REDIS_PASSWORD" --scan --pattern 'ai:query-cache:v1:*' | xargs -r redis-cli -a "$REDIS_PASSWORD" del
exit
```

## 13. Backup и восстановление

Backup Postgres:

```bash
mkdir -p /opt/pgmu/backups
docker compose -f docker-compose.dev.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > /opt/pgmu/backups/pgmu-$(date +%F-%H%M).sql
```

Backup volumes:

```bash
docker run --rm \
  -v bot_postgres_data:/from \
  -v /opt/pgmu/backups:/backup \
  alpine tar czf /backup/postgres-volume-$(date +%F-%H%M).tar.gz -C /from .

docker run --rm \
  -v bot_weaviate_data:/from \
  -v /opt/pgmu/backups:/backup \
  alpine tar czf /backup/weaviate-volume-$(date +%F-%H%M).tar.gz -C /from .
```

Восстановление Postgres из SQL:

```bash
cat /opt/pgmu/backups/pgmu-YYYY-MM-DD-HHMM.sql | docker compose -f docker-compose.dev.yml exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

После восстановления базы заново прогоните refresh индекса:

```bash
docker compose -f docker-compose.dev.yml exec -T nestjs node dist/scripts/search-base-refresh.js --force --locale=ru
```

## 14. Частые проблемы

### Ollama connection refused

В Docker `.env` должно быть:

```dotenv
EMBEDDING_VECTORIZATION_URL=http://ollama:11434
```

Проверка:

```bash
docker compose -f docker-compose.dev.yml logs --since 10m ollama
docker compose -f docker-compose.dev.yml exec -T ollama ollama list
```

### Search returns 0 results

Проверить порядок:

```bash
docker compose -f docker-compose.dev.yml exec -T nestjs npm run db:seed
docker compose -f docker-compose.dev.yml exec -T nestjs node dist/scripts/search-base-refresh.js --force --locale=ru
```

Проверьте class name:

```dotenv
EMBEDDING_DATABASE_CLASS_NAME=PsmuKnowledgeEmbeddings
```

### Dimension mismatch в Weaviate

Это значит, что старый класс был создан под другую размерность эмбеддингов. Используйте новый класс:

```dotenv
EMBEDDING_DATABASE_CLASS_NAME=PsmuKnowledgeEmbeddings
```

Потом пересоберите и refresh:

```bash
docker compose -f docker-compose.dev.yml up -d --build --force-recreate nestjs
docker compose -f docker-compose.dev.yml exec -T nestjs node dist/scripts/search-base-refresh.js --force --locale=ru
```

### Виджет не сохраняет историю

Проверьте cookie-настройки:

```dotenv
SESSION_COOKIE_SAMESITE=none
SESSION_COOKIE_SECURE=true
```

Проверьте HTTPS и CORS:

```dotenv
CORS_ORIGINS=https://psmu.ru,https://www.psmu.ru
```

### Старые ответы после исправления кода

Очистить query cache Redis:

```bash
docker compose -f docker-compose.dev.yml exec redis sh
redis-cli --scan --pattern 'ai:query-cache:v1:*' | xargs -r redis-cli del
exit
```

Если Redis с паролем, используйте `redis-cli -a "$REDIS_PASSWORD"`.

## 15. Минимальный чеклист готовности

- `docker compose ps` показывает `nestjs`, `postgres`, `redis`, `weaviate`, `ollama` в up/healthy состоянии.
- `curl http://127.0.0.1:3500/api/health/live` возвращает 200.
- `curl http://127.0.0.1:3500/api/health/ready` возвращает 200 или понятную ошибку конкретного компонента.
- `npm run db:seed` внутри `nestjs` завершился без ошибки.
- `search-base-refresh` завершился с `failed=0`.
- `widget.js` и `widget.css` отдаются.
- Тестовый POST `/api/v1/messaging/messages` отвечает по ФАЦ ПГМУ.
- На сайте подключен script-widget с HTTPS-домена.
