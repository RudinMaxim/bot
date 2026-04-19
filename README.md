# MAX Accreditation Bot

NestJS backend for a MAX messenger bot that does only two things:
- answers from the accreditation knowledge base;
- routes the user to a профильный специалист when the answer is partial or unreliable.

## Runtime Surface

Active HTTP surface:
- `POST /api/v1/max/webhook`
- `GET /api/health/live`
- `GET /api/health/ready`

The old widget, websocket, TTS, site-assistant, and browser-specific transport are removed from the active runtime.

## Required Env

Minimum required variables:

```env
POSTGRES_URL=postgres://postgres:postgres@postgres:5432/developer-ai
REDIS_HOST=redis
OPENROUTER_API_KEY=sk-or-...
MAX_BOT_TOKEN=
MAX_WEBHOOK_SECRET=
```

Optional MAX settings:

```env
MAX_BOT_API_BASE_URL=https://platform-api.max.ru
MAX_WEBHOOK_PATH=/api/v1/max/webhook
MAX_WEBHOOK_BASE_URL=
```

## Local Run

```bash
npm install
npm run start:dev
```

## Verification

```bash
npm run typecheck
npm run test -- src/domain/ai/common/tests/specialist-catalog.service.spec.ts src/domain/ai/agents/coordinator/common/tests/coordinator.agent.spec.ts src/domain/ai/common/tests/orchestrator.service.spec.ts src/domain/ai/agents/response/common/tests/response.agent.spec.ts src/domain/ai/agents/search/common/tests/search.agent.spec.ts src/domain/ai/common/tests/ai.service.spec.ts src/domain/messaging/common/tests/max-adapter.service.spec.ts src/domain/messaging/common/tests/max-bot-api.service.spec.ts src/domain/messaging/common/tests/max-webhook.controller.spec.ts src/domain/messaging/common/tests/messaging.module.spec.ts src/domain/messaging/common/tests/max-only-cleanup.spec.ts src/infrastructure/config/register/secrets.config.spec.ts src/infrastructure/config/schemas/secrets.schema.spec.ts src/shared/security/security.module.spec.ts
```
