# Accreditation Messaging Widget

NestJS backend for a minimal embeddable accreditation assistant:
- answers from the accreditation knowledge base;
- routes the user to a профильный специалист when the answer is partial or unreliable;
- exposes a small script widget for regular websites.

## Runtime Surface

Active HTTP surface:
- `GET /api/v1/messaging/widget.js`
- `GET /api/v1/messaging/widget.css`
- `POST /api/v1/messaging/session`
- `POST /api/v1/messaging/messages`
- `POST /api/v1/messaging/clear`
- `GET /api/health/live`
- `GET /api/health/ready`

Embed:

```html
<script src="https://your-domain/api/v1/messaging/widget.js" defer></script>
```

The widget is vanilla JavaScript plus plain CSS. It stores the issued `chatId` locally as a convenience, while the server keeps the authoritative chat ownership mapping in the signed session cookie and Redis.

## Required Env

Minimum required variables:

```env
POSTGRES_URL=postgres://postgres:postgres@postgres:5432/developer-ai
REDIS_HOST=redis
OPENROUTER_API_KEY=sk-or-...
SESSION_SIGNING_KEY=change-me-min-32-bytes
JWT_SIGNING_KEY=change-me-min-32-bytes
```

## Local Run

```powershell
npm install
npm run dev:infra
npm run db:migration:run:local
npm run db:seed
npm run dev:api
```

In a second terminal:

```powershell
npm run dev:widget
```

Open `http://127.0.0.1:4000`. The page embeds
`http://localhost:3500/api/v1/messaging/widget.js`.

For local HTTP testing keep these values in `.env.local`:

```env
SESSION_COOKIE_SAMESITE=lax
SESSION_COOKIE_SECURE=false
CORS_ORIGINS=http://localhost:4000,http://127.0.0.1:4000
```

Set a real `OPENROUTER_API_KEY` before asking the widget questions. Without it,
the widget page still opens, but AI responses will fail.

This workspace includes `.env.local` with local-only overrides for cookies,
CORS, Postgres, Redis, Weaviate and Ollama. Keep the real
`OPENROUTER_API_KEY` in `.env`, or add it to `.env.local` locally.

## Verification

```bash
npm run typecheck
npm run test -- src/domain/messaging/common/tests/messaging-widget.controller.spec.ts src/domain/messaging/common/tests/messaging.module.spec.ts src/domain/messaging/common/tests/script-widget-cleanup.spec.ts src/domain/messaging/common/tests/message.service.spec.ts test/scripts/widget-dev-server.spec.ts
```
