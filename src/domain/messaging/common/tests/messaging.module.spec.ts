import 'reflect-metadata';

process.env.POSTGRES_URL =
    process.env.POSTGRES_URL ||
    'postgres://postgres:postgres@postgres:5432/app';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
process.env.OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY || 'sk-or-test';
process.env.MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || 'token';
process.env.MAX_WEBHOOK_SECRET = process.env.MAX_WEBHOOK_SECRET || 'secret';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MessagingModule } = require('../../messaging.module');

describe('MessagingModule', () => {
    it('wires MAX webhook transport as the active controller surface', () => {
        const controllers: Array<{ name?: string }> =
            Reflect.getMetadata('controllers', MessagingModule) ?? [];
        const providers: Array<{ name?: string }> =
            Reflect.getMetadata('providers', MessagingModule) ?? [];
        const controllerNames = controllers.map((item) => item.name);
        const providerNames = providers.map((item) => item.name);

        expect(controllerNames).toContain('MaxWebhookController');
        expect(controllerNames).not.toContain('MessagingController');
        expect(controllerNames).not.toContain('TtsController');

        expect(providerNames).toContain('MaxAdapterService');
        expect(providerNames).toContain('MaxBotApiService');
        expect(providerNames).not.toContain('MessagingGateway');
    });
});
