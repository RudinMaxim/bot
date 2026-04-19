# MAX Accreditation Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the MAX accreditation bot by keeping only knowledge-base answering plus specialist routing, migrating transport from widget/websocket to MAX webhook delivery, and deleting code that no longer serves the product.

**Architecture:** The active runtime becomes `MAX webhook -> messaging/message service -> coordinator/search/response -> MAX bot API`. The AI narrowing work is already in place; the remaining work is to add MAX transport, switch bootstrap/module wiring, and remove widget, settings, TTS, and site-assistant code from active modules.

**Tech Stack:** NestJS, TypeScript, Jest, Axios/HttpModule, local JSON assets, MAX Bot API over HTTPS

---

## File Structure

- Modify: `src/main.ts`
- Modify: `src/app.module.ts`
- Modify: `src/infrastructure/config/interfaces/secrets.interface.ts`
- Modify: `src/infrastructure/config/register/secrets.config.ts`
- Modify: `src/infrastructure/config/schemas/secrets.schema.ts`
- Modify: `src/domain/messaging/messaging.module.ts`
- Modify: `src/domain/messaging/controller/index.ts`
- Modify: `src/domain/messaging/services/index.ts`
- Modify: `src/domain/messaging/common/types/messaging-adapter.interface.ts`
- Modify: `src/domain/messaging/common/types/message.types.ts`
- Modify: `src/domain/messaging/services/message.service.ts`
- Modify: `src/infrastructure/integration/integration.module.ts`
- Modify: `src/infrastructure/integration/controller/index.ts`
- Modify: `src/app.module.ts`
- Modify: `.env.example`
- Create: `src/domain/messaging/controller/max-webhook.controller.ts`
- Create: `src/domain/messaging/services/max-adapter.service.ts`
- Create: `src/domain/messaging/services/max-bot-api.service.ts`
- Create: `src/domain/messaging/common/types/max.types.ts`
- Create: `src/domain/messaging/common/tests/max-adapter.service.spec.ts`
- Create: `src/domain/messaging/common/tests/max-bot-api.service.spec.ts`
- Create: `src/domain/messaging/common/tests/max-webhook.controller.spec.ts`
- Create: `src/domain/messaging/common/tests/messaging.module.spec.ts`
- Delete: `src/domain/messaging/controller/messaging.controller.ts`
- Delete: `src/domain/messaging/controller/messaging-websocket-docs.controller.ts`
- Delete: `src/domain/messaging/controller/messaging.getaway.ts`
- Delete: `src/domain/messaging/controller/tts.controller.ts`
- Delete: `src/domain/messaging/services/web.service.ts`
- Delete: `src/domain/messaging/services/site-action-runner.service.ts`
- Delete: `src/domain/messaging/services/speech-recognition.service.ts`
- Delete: `src/domain/messaging/services/speech-synthesis.service.ts`
- Delete: `src/domain/messaging/common/constants/audio.constants.ts`
- Delete: `src/domain/messaging/common/constants/site-action.constants.ts`
- Delete: `src/domain/messaging/common/constants/websocket.constants.ts`
- Delete: `src/domain/messaging/common/types/messaging-http.types.ts`
- Delete: `src/domain/messaging/common/types/site-action-runner.types.ts`
- Delete: `src/domain/messaging/common/types/speech-recognition.types.ts`
- Delete: `src/domain/messaging/common/types/speech-synthesis.types.ts`
- Delete: `src/domain/messaging/common/types/websocket.types.ts`
- Delete: `src/domain/messaging/common/utils/socket-io-server.util.ts`
- Delete: `src/domain/messaging/common/utils/speech-recognition-error.util.ts`
- Delete: `src/domain/messaging/common/utils/speech-synthesis-error.util.ts`
- Delete: `src/domain/messaging/common/utils/speech-synthesis-markup.util.ts`
- Delete: `src/domain/messaging/common/utils/voice-request-error.util.ts`
- Delete: `src/domain/messaging/common/utils/websocket-validation.util.ts`
- Delete: `src/infrastructure/integration/controller/integration-settings.controller.ts`
- Delete: `src/infrastructure/integration/controller/site-assistant-elements.controller.ts`
- Delete: `src/infrastructure/integration/controller/site-assistant-settings.controller.ts`
- Delete: `src/infrastructure/integration/controller/widget-settings.controller.ts`
- Delete: `src/domain/settings/**`
- Delete: `src/domain/ai/agents/site-assistant/**`

## Task 1: Completed AI foundation for accreditation modes

**Files:**
- Create: `src/domain/ai/common/types/specialist.types.ts`
- Create: `src/domain/ai/services/specialist-catalog.service.ts`
- Create: `src/domain/ai/common/tests/specialist-catalog.service.spec.ts`
- Create: `resources/knowledge-base/specialists/ru.json`
- Modify: `src/domain/ai/common/constants/ai.constants.ts`
- Modify: `src/domain/ai/ai.module.ts`
- Modify: `src/domain/ai/agents/coordinator/common/types/coordinator.types.ts`
- Modify: `src/domain/ai/agents/coordinator/coordinator.agent.ts`
- Modify: `src/domain/ai/agents/coordinator/common/tests/coordinator.agent.spec.ts`

- [x] **Step 1: Add explicit accreditation reply modes**

```ts
export type AssistantMode =
    | 'answer'
    | 'clarify'
    | 'partial_with_specialist'
    | 'route_to_specialist';
```

- [x] **Step 2: Add specialist catalog runtime and tests**

```ts
findBestMatch(query: string, specialists = this.catalog): SpecialistRecord | undefined {
    const normalized = query.toLowerCase();
    const ranked = specialists
        .map((specialist) => ({
            specialist,
            score: specialist.topics.filter((topic) =>
                normalized.includes(topic.toLowerCase()),
            ).length,
        }))
        .sort((left, right) => right.score - left.score);

    return ranked[0]?.score ? ranked[0].specialist : specialists.find((item) => item.isDefault);
}
```

- [x] **Step 3: Rewrite the coordinator contract for the four modes**

```ts
type CoordinatorDecision = {
    mode: AssistantMode;
    clarificationQuestions?: string[];
    routingReason?: string;
};
```

- [x] **Step 4: Verify completed AI foundation**

Run: `npm run test -- src/domain/ai/common/tests/specialist-catalog.service.spec.ts src/domain/ai/agents/coordinator/common/tests/coordinator.agent.spec.ts`

Expected: PASS with the specialist and coordinator suites green.

## Task 2: Completed search/orchestrator/response narrowing

**Files:**
- Modify: `src/domain/ai/services/orchestrator.service.ts`
- Modify: `src/domain/ai/agents/response/response.agent.ts`
- Modify: `src/domain/ai/agents/response/common/types/response.types.ts`
- Modify: `src/domain/ai/agents/response/common/tests/response.agent.spec.ts`
- Modify: `src/domain/ai/agents/search/common/types/search.types.ts`
- Modify: `src/domain/ai/agents/search/search.agent.ts`
- Modify: `src/domain/ai/agents/search/common/tests/search.agent.spec.ts`
- Modify: `src/domain/ai/services/ai.service.ts`
- Modify: `src/domain/ai/common/tests/ai.service.spec.ts`
- Modify: `resources/knowledge-base/search-base/mys/ru.json`

- [x] **Step 1: Limit orchestration to coordinator, search, and response**

```ts
const coordination = await this.coordinator.process(input, context);
if (coordination.mode === 'clarify') {
    return this.handleClarification(...);
}

const searchResult = await this.search.process(searchInput, context);
return this.response.process(responseInput, context);
```

- [x] **Step 2: Make response formatting deterministic**

```ts
switch (mode) {
    case 'clarify':
        return { mode, response: questions.join('\n') };
    case 'partial_with_specialist':
        return { mode, response: `${knowledge}\n\n${specialistBlock}` };
    default:
        return { mode, response: knowledge };
}
```

- [x] **Step 3: Add `coverage` metadata to search results**

```ts
export type SearchCoverage = 'full' | 'partial' | 'none';
```

- [x] **Step 4: Disable the old assistant fast path**

```ts
private async tryFastPath(...): Promise<AiResponse | null> {
    return null;
}
```

- [x] **Step 5: Verify the narrowed AI path**

Run: `npm run test -- src/domain/ai/common/tests/orchestrator.service.spec.ts src/domain/ai/agents/response/common/tests/response.agent.spec.ts src/domain/ai/agents/search/common/tests/search.agent.spec.ts src/domain/ai/common/tests/ai.service.spec.ts`

Expected: PASS with all targeted suites green.

## Task 3: Add MAX transport config and contracts

**Files:**
- Create: `src/domain/messaging/common/types/max.types.ts`
- Modify: `src/domain/messaging/common/types/messaging-adapter.interface.ts`
- Modify: `src/domain/messaging/common/types/message.types.ts`
- Modify: `src/infrastructure/config/interfaces/secrets.interface.ts`
- Modify: `src/infrastructure/config/register/secrets.config.ts`
- Modify: `src/infrastructure/config/schemas/secrets.schema.ts`
- Modify: `.env.example`
- Test: `src/domain/messaging/common/tests/max-adapter.service.spec.ts`

- [x] **Step 1: Write the failing transport/config tests**

```ts
describe('MAX transport config', () => {
    it('parses MAX bot settings from secrets config', () => {
        const parsed = validateSecretsConfig({
            POSTGRES_URL: 'postgres://example',
            REDIS_HOST: 'localhost',
            OPENROUTER_API_KEY: 'key',
            MAX_BOT_TOKEN: 'token',
            MAX_BOT_API_BASE_URL: 'https://platform-api.max.ru',
            MAX_WEBHOOK_SECRET: 'secret',
        });

        expect(parsed.MAX_BOT_TOKEN).toBe('token');
        expect(parsed.MAX_BOT_API_BASE_URL).toBe('https://platform-api.max.ru');
    });
});
```

```ts
it('maps MAX incoming text updates into IncomingMessage', async () => {
    const normalized = service.normalizeUpdate({
        update_id: 101,
        message: {
            message_id: 'm-1',
            text: 'Какой статус заявки?',
            chat: { chat_id: 'chat-1', type: 'dialog' },
            from: { user_id: 'user-1', username: 'max-user' },
            timestamp: 1711111111,
        },
    });

    expect(normalized).toMatchObject({
        chatId: 'chat-1',
        userId: 'user-1',
        type: 'text',
        content: 'Какой статус заявки?',
    });
});
```

- [x] **Step 2: Run the failing tests**

Run: `npm run test -- src/domain/messaging/common/tests/max-adapter.service.spec.ts src/infrastructure/config/schemas/secrets.schema.spec.ts`

Expected: FAIL with missing MAX config fields and missing MAX transport types/services.

- [x] **Step 3: Add MAX-specific types and strip widget-specific adapter shape**

```ts
export interface MaxUser {
    user_id: string;
    username?: string;
    first_name?: string;
}

export interface MaxChat {
    chat_id: string;
    type: string;
}

export interface MaxMessageUpdate {
    update_id: number;
    message?: {
        message_id: string;
        text?: string;
        chat: MaxChat;
        from: MaxUser;
        timestamp: number;
    };
    callback_query?: {
        callback_id: string;
        data?: string;
        chat_id: string;
        from: MaxUser;
    };
}
```

```ts
export abstract class IMessagingAdapter {
    abstract readonly platform: string;
    abstract sendMessage(message: OutgoingMessage): Promise<string>;
    abstract onMessage(callback: (message: IncomingMessage) => Promise<void>): void;
    abstract shutdown(): Promise<void>;
}
```

- [x] **Step 4: Add MAX secrets to config**

```ts
max: {
    botToken: string;
    apiBaseUrl: string;
    webhookSecret: string;
    webhookPath: string;
    webhookBaseUrl?: string;
}
```

```ts
MAX_BOT_TOKEN: z.string().min(1, { message: 'MAX_BOT_TOKEN is required' }),
MAX_BOT_API_BASE_URL: z.string().url().default('https://platform-api.max.ru'),
MAX_WEBHOOK_SECRET: z.string().min(1, { message: 'MAX_WEBHOOK_SECRET is required' }),
MAX_WEBHOOK_PATH: z.string().default('/api/v1/max/webhook'),
MAX_WEBHOOK_BASE_URL: z.string().url().optional(),
```

- [x] **Step 5: Document the new env variables**

```env
MAX_BOT_TOKEN=
MAX_BOT_API_BASE_URL=https://platform-api.max.ru
MAX_WEBHOOK_SECRET=
MAX_WEBHOOK_PATH=/api/v1/max/webhook
MAX_WEBHOOK_BASE_URL=
```

- [x] **Step 6: Run the targeted tests**

Run: `npm run test -- src/domain/messaging/common/tests/max-adapter.service.spec.ts src/infrastructure/config/schemas/secrets.schema.spec.ts`

Expected: PASS with MAX config parsing and type normalization tests green.

- [x] **Step 7: Commit**

```bash
git add .env.example src/domain/messaging/common/types/max.types.ts src/domain/messaging/common/types/messaging-adapter.interface.ts src/domain/messaging/common/types/message.types.ts src/infrastructure/config/interfaces/secrets.interface.ts src/infrastructure/config/register/secrets.config.ts src/infrastructure/config/schemas/secrets.schema.ts src/domain/messaging/common/tests/max-adapter.service.spec.ts
git commit -m "feat: add MAX transport config and contracts"
```

## Task 4: Implement MAX inbound webhook and outbound bot client

**Files:**
- Create: `src/domain/messaging/controller/max-webhook.controller.ts`
- Create: `src/domain/messaging/services/max-adapter.service.ts`
- Create: `src/domain/messaging/services/max-bot-api.service.ts`
- Modify: `src/domain/messaging/services/index.ts`
- Modify: `src/domain/messaging/controller/index.ts`
- Test: `src/domain/messaging/common/tests/max-webhook.controller.spec.ts`
- Test: `src/domain/messaging/common/tests/max-bot-api.service.spec.ts`
- Test: `src/domain/messaging/common/tests/max-adapter.service.spec.ts`

- [x] **Step 1: Write the failing webhook/client tests**

```ts
it('rejects webhook requests with an invalid MAX secret', async () => {
    await request(app.getHttpServer())
        .post('/api/v1/max/webhook')
        .set('x-max-secret', 'wrong')
        .send({ update_id: 1 })
        .expect(401);
});

it('sends a MAX text message through the bot API', async () => {
    httpService.post.mockReturnValue(of({ data: { message_id: 'out-1' } }));

    const result = await service.sendMessage({
        chatId: 'chat-1',
        content: 'По базе знаний нашёлся такой порядок: ...',
    });

    expect(result).toBe('out-1');
    expect(httpService.post).toHaveBeenCalledWith(
        'https://platform-api.max.ru/messages',
        expect.objectContaining({
            chat_id: 'chat-1',
            text: 'По базе знаний нашёлся такой порядок: ...',
        }),
        expect.any(Object),
    );
});
```

- [x] **Step 2: Run the failing tests**

Run: `npm run test -- src/domain/messaging/common/tests/max-webhook.controller.spec.ts src/domain/messaging/common/tests/max-bot-api.service.spec.ts src/domain/messaging/common/tests/max-adapter.service.spec.ts`

Expected: FAIL with missing controller/service exports and unmet expectations.

- [x] **Step 3: Implement the MAX bot API client**

```ts
@Injectable()
export class MaxBotApiService extends IMessagingAdapter {
    readonly platform = 'max';

    constructor(
        private readonly httpService: HttpService,
        private readonly secretsConfig: SecretsConfig,
    ) {
        super();
    }

    async sendMessage(message: OutgoingMessage): Promise<string> {
        const response = await firstValueFrom(
            this.httpService.post(
                `${this.secretsConfig.max.apiBaseUrl}/messages`,
                {
                    chat_id: message.chatId,
                    text: message.content ?? '',
                    reply_to_message_id: message.replyToMessageId,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.secretsConfig.max.botToken}`,
                    },
                },
            ),
        );

        return String(response.data?.message_id ?? '');
    }

    onMessage(): void {}
    async shutdown(): Promise<void> {}
}
```

- [x] **Step 4: Implement update normalization and webhook handling**

```ts
@Injectable()
export class MaxAdapterService {
    normalizeUpdate(update: MaxMessageUpdate): IncomingMessage | null {
        if (!update.message?.text) {
            return null;
        }

        return {
            messageId: update.message.message_id,
            chatId: update.message.chat.chat_id,
            userId: update.message.from.user_id,
            username: update.message.from.username,
            type: MessageType.TEXT,
            content: update.message.text,
            timestamp: new Date(update.message.timestamp * 1000),
            metadata: {
                platform: 'max',
                chatId: update.message.chat.chat_id,
                messageId: update.message.message_id,
                userId: update.message.from.user_id,
                inputType: MessageType.TEXT,
                sessionId: update.message.chat.chat_id,
                timestamp: new Date(update.message.timestamp * 1000).toISOString(),
            },
        };
    }
}
```

```ts
@Controller('max')
export class MaxWebhookController {
    constructor(
        private readonly adapter: MaxAdapterService,
        private readonly messageService: MessageService,
        private readonly maxBotApi: MaxBotApiService,
        private readonly secretsConfig: SecretsConfig,
    ) {}

    @Post('webhook')
    async handle(
        @Headers('x-max-secret') secret: string | undefined,
        @Body() update: MaxMessageUpdate,
    ): Promise<{ ok: true }> {
        if (secret !== this.secretsConfig.max.webhookSecret) {
            throw new UnauthorizedException();
        }

        const message = this.adapter.normalizeUpdate(update);
        if (!message) {
            return { ok: true };
        }

        const processed = await this.messageService.handleMessage(message);
        await this.maxBotApi.sendMessage({
            chatId: message.chatId,
            content: processed.response,
            replyToMessageId: message.messageId,
        });

        return { ok: true };
    }
}
```

- [x] **Step 5: Run the targeted tests**

Run: `npm run test -- src/domain/messaging/common/tests/max-webhook.controller.spec.ts src/domain/messaging/common/tests/max-bot-api.service.spec.ts src/domain/messaging/common/tests/max-adapter.service.spec.ts`

Expected: PASS with webhook auth, normalization, and outbound sending green.

- [x] **Step 6: Commit**

```bash
git add src/domain/messaging/controller/max-webhook.controller.ts src/domain/messaging/services/max-adapter.service.ts src/domain/messaging/services/max-bot-api.service.ts src/domain/messaging/services/index.ts src/domain/messaging/controller/index.ts src/domain/messaging/common/tests/max-webhook.controller.spec.ts src/domain/messaging/common/tests/max-bot-api.service.spec.ts src/domain/messaging/common/tests/max-adapter.service.spec.ts
git commit -m "feat: add MAX webhook transport"
```

## Task 5: Switch the active runtime to MAX-only transport

**Files:**
- Modify: `src/domain/messaging/messaging.module.ts`
- Modify: `src/domain/messaging/services/message.service.ts`
- Modify: `src/main.ts`
- Modify: `src/app.module.ts`
- Test: `src/domain/messaging/common/tests/messaging.module.spec.ts`
- Test: `src/domain/messaging/common/tests/message.service.spec.ts`

- [x] **Step 1: Write the failing runtime-switch tests**

```ts
it('wires the messaging module without websocket or TTS providers', async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [MessagingModule],
    }).compile();

    expect(moduleRef.get(MaxBotApiService)).toBeDefined();
    expect(() => moduleRef.get('MessagingGateway')).toThrow();
});
```

```ts
it('does not expose voice-processing entry points in MessageService anymore', () => {
    const service = moduleRef.get(MessageService) as unknown as Record<string, unknown>;
    expect('handleVoiceMessage' in service).toBe(false);
    expect('processVoiceRequest' in service).toBe(false);
});
```

- [x] **Step 2: Run the failing tests**

Run: `npm run test -- src/domain/messaging/common/tests/messaging.module.spec.ts src/domain/messaging/common/tests/message.service.spec.ts`

Expected: FAIL because the module still depends on websocket/TTS services and `main.ts` still initializes `WebAdapterService`.

- [x] **Step 3: Rewire the messaging module around MAX**

```ts
@Module({
    imports: [ConfigModule, AiModule, HttpModule],
    providers: [
        MessageService,
        MaxAdapterService,
        MaxBotApiService,
        MessageCacheRepository,
    ],
    controllers: [MaxWebhookController],
    exports: [MessageService, MaxBotApiService],
})
export class MessagingModule {}
```

- [x] **Step 4: Remove websocket bootstrap from `main.ts`**

```ts
async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    // ... existing global wiring ...
    await app.listen(port, globalConfig.server.host);
    logger.log(`HTTP server started on ${globalConfig.server.host}:${port}`);
}
```

- [x] **Step 5: Narrow `MessageService` to text/feedback/history only**

```ts
export interface IMessageHandler {
    handleMessage(message: IncomingMessage, callbacks?: PipelineCallbacks): Promise<ProcessedMessage>;
    handleCommand(message: IncomingMessage, command: string): Promise<ProcessedMessage>;
    handleFeedback(feedback: FeedbackCommand): Promise<boolean>;
    getMessageHistory(chatId: string, limit?: number): Promise<MessageHistoryItem[]>;
}
```

```ts
// Remove:
// - handleVoiceMessage
// - processVoiceRequest
// - speechRecognition dependency
```

- [x] **Step 6: Run the targeted tests**

Run: `npm run test -- src/domain/messaging/common/tests/messaging.module.spec.ts src/domain/messaging/common/tests/message.service.spec.ts`

Expected: PASS with the messaging module and message service green under MAX-only wiring.

- [ ] **Step 7: Commit**

```bash
git add src/domain/messaging/messaging.module.ts src/domain/messaging/services/message.service.ts src/domain/messaging/common/types/message-handler.interface.ts src/main.ts src/app.module.ts src/domain/messaging/common/tests/messaging.module.spec.ts src/domain/messaging/common/tests/message.service.spec.ts
git commit -m "refactor: switch runtime transport to MAX"
```

## Task 6: Remove obsolete widget, settings, and site-assistant code

**Files:**
- Modify: `src/infrastructure/integration/integration.module.ts`
- Modify: `src/infrastructure/integration/controller/index.ts`
- Modify: `src/domain/messaging/controller/index.ts`
- Modify: `src/domain/messaging/services/index.ts`
- Delete: `src/domain/messaging/controller/messaging.controller.ts`
- Delete: `src/domain/messaging/controller/messaging-websocket-docs.controller.ts`
- Delete: `src/domain/messaging/controller/messaging.getaway.ts`
- Delete: `src/domain/messaging/controller/tts.controller.ts`
- Delete: `src/domain/messaging/services/web.service.ts`
- Delete: `src/domain/messaging/services/site-action-runner.service.ts`
- Delete: `src/domain/messaging/services/speech-recognition.service.ts`
- Delete: `src/domain/messaging/services/speech-synthesis.service.ts`
- Delete: `src/domain/settings/**`
- Delete: `src/domain/ai/agents/site-assistant/**`
- Delete: `src/infrastructure/integration/controller/integration-settings.controller.ts`
- Delete: `src/infrastructure/integration/controller/site-assistant-elements.controller.ts`
- Delete: `src/infrastructure/integration/controller/site-assistant-settings.controller.ts`
- Delete: `src/infrastructure/integration/controller/widget-settings.controller.ts`
- Test: `src/domain/messaging/common/tests/messaging.module.spec.ts`

- [x] **Step 1: Write a failing cleanup regression test**

```ts
it('integration module exposes only search-base, feedback, fos, and metrics controllers', () => {
    const controllers = Reflect.getMetadata('controllers', IntegrationModule) ?? [];
    const names = controllers.map((controller: { name: string }) => controller.name);

    expect(names).toEqual(
        expect.arrayContaining([
            'IntegrationSearchBaseController',
            'IntegrationFeedbackController',
        ]),
    );
    expect(names).not.toContain('IntegrationSettingsController');
    expect(names).not.toContain('SiteAssistantElementsController');
    expect(names).not.toContain('WidgetSettingsController');
});
```

- [x] **Step 2: Run the failing cleanup test**

Run: `npm run test -- src/domain/messaging/common/tests/messaging.module.spec.ts`

Expected: FAIL because removed controllers are still exported or wired.

- [x] **Step 3: Remove obsolete controllers and providers from module indexes**

```ts
export * from './max-webhook.controller';
```

```ts
export * from './message.service';
export * from './max-adapter.service';
export * from './max-bot-api.service';
```

```ts
@Module({
    imports: [AiModule, ConfigModule, SearchBaseModule],
    controllers: [
        IntegrationSearchBaseController,
        IntegrationFosController,
        IntegrationFeedbackController,
        IntegrationMetricsController,
    ],
})
export class IntegrationModule {}
```

- [x] **Step 4: Delete the dead widget/site-assistant/settings files**

Run:

```powershell
Remove-Item -LiteralPath "src/domain/messaging/controller/messaging.controller.ts" -Force
Remove-Item -LiteralPath "src/domain/messaging/controller/messaging-websocket-docs.controller.ts" -Force
Remove-Item -LiteralPath "src/domain/messaging/controller/messaging.getaway.ts" -Force
Remove-Item -LiteralPath "src/domain/messaging/controller/tts.controller.ts" -Force
Remove-Item -LiteralPath "src/domain/messaging/services/web.service.ts" -Force
Remove-Item -LiteralPath "src/domain/messaging/services/site-action-runner.service.ts" -Force
Remove-Item -LiteralPath "src/domain/messaging/services/speech-recognition.service.ts" -Force
Remove-Item -LiteralPath "src/domain/messaging/services/speech-synthesis.service.ts" -Force
Remove-Item -LiteralPath "src/infrastructure/integration/controller/integration-settings.controller.ts" -Force
Remove-Item -LiteralPath "src/infrastructure/integration/controller/site-assistant-elements.controller.ts" -Force
Remove-Item -LiteralPath "src/infrastructure/integration/controller/site-assistant-settings.controller.ts" -Force
Remove-Item -LiteralPath "src/infrastructure/integration/controller/widget-settings.controller.ts" -Force
Remove-Item -LiteralPath "src/domain/settings" -Recurse -Force
Remove-Item -LiteralPath "src/domain/ai/agents/site-assistant" -Recurse -Force
```

Expected: files and directories removed without touching unrelated code.

- [x] **Step 5: Run the targeted cleanup tests**

Run: `npm run test -- src/domain/messaging/common/tests/messaging.module.spec.ts`

Expected: PASS with only supported controllers/providers still wired.

- [ ] **Step 6: Commit**

### Current follow-up cleanup in progress

- [x] Remove leftover `visuals` and `username` fields from active MAX/messaging/AI contracts and history payloads
- [x] Re-run typecheck and the focused MAX/messaging suites after that cleanup

```bash
git add src/infrastructure/integration/integration.module.ts src/infrastructure/integration/controller/index.ts src/domain/messaging/controller/index.ts src/domain/messaging/services/index.ts
git add -A src/domain/messaging src/domain/settings src/domain/ai/agents/site-assistant src/infrastructure/integration/controller
git commit -m "refactor: remove widget and site assistant runtime"
```

## Task 7: Verify the MAX-only application end to end

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-04-19-max-accreditation-agent-implementation.md`
- Test: targeted Jest suites

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS with `exit 0`.

- [ ] **Step 2: Run the focused MAX and AI suites**

Run: `npm run test -- src/domain/ai/common/tests/specialist-catalog.service.spec.ts src/domain/ai/agents/coordinator/common/tests/coordinator.agent.spec.ts src/domain/ai/common/tests/orchestrator.service.spec.ts src/domain/ai/agents/response/common/tests/response.agent.spec.ts src/domain/ai/agents/search/common/tests/search.agent.spec.ts src/domain/ai/common/tests/ai.service.spec.ts src/domain/messaging/common/tests/max-adapter.service.spec.ts src/domain/messaging/common/tests/max-bot-api.service.spec.ts src/domain/messaging/common/tests/max-webhook.controller.spec.ts src/domain/messaging/common/tests/messaging.module.spec.ts`

Expected: PASS with all targeted suites green.

- [ ] **Step 3: Update README startup/config notes**

```md
## MAX Bot Runtime

- Configure `MAX_BOT_TOKEN`, `MAX_WEBHOOK_SECRET`, and `MAX_WEBHOOK_BASE_URL`
- Expose `POST /api/v1/max/webhook` to MAX
- Refresh the knowledge base through the integration endpoint when content changes
```

- [ ] **Step 4: Mark completed plan items**

```md
- [x] Task 1 completed
- [x] Task 2 completed
```

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/plans/2026-04-19-max-accreditation-agent-implementation.md
git commit -m "docs: finalize MAX accreditation migration plan"
```

## Self-Review

- Spec coverage: the plan covers the narrowed AI runtime, MAX transport, bootstrap/module switch, dead-code removal, and final verification.
- Placeholder scan: no `TODO`, `TBD`, or undefined execution steps remain.
- Type consistency: the plan uses one transport shape centered on `IncomingMessage`, `OutgoingMessage`, `AssistantMode`, and MAX webhook update types.
