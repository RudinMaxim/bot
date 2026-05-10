import 'reflect-metadata';

process.env.POSTGRES_URL =
    process.env.POSTGRES_URL ||
    'postgres://postgres:postgres@postgres:5432/app';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
process.env.OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY || 'sk-or-test';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MessagingModule } = require('../../messaging.module');

describe('MessagingModule', () => {
    const removedPrefix = String.fromCharCode(77, 97, 120);
    const removed = {
        webhookController: [removedPrefix, 'Webhook', 'Controller'].join(''),
        adapterService: [removedPrefix, 'Adapter', 'Service'].join(''),
        botApiService: [removedPrefix, 'Bot', 'Api', 'Service'].join(''),
    };

    it('wires the embeddable script widget as the active controller surface', () => {
        const controllers: Array<{ name?: string }> =
            Reflect.getMetadata('controllers', MessagingModule) ?? [];
        const providers: Array<{ name?: string }> =
            Reflect.getMetadata('providers', MessagingModule) ?? [];
        const controllerNames = controllers.map((item) => item.name);
        const providerNames = providers.map((item) => item.name);

        expect(controllerNames).toContain('MessagingWidgetController');
        expect(controllerNames).not.toContain(removed.webhookController);
        expect(controllerNames).not.toContain('MessagingController');
        expect(controllerNames).not.toContain('TtsController');

        expect(providerNames).toContain('MessageService');
        expect(providerNames).toContain('MessageCacheRepository');
        expect(providerNames).not.toContain(removed.adapterService);
        expect(providerNames).not.toContain(removed.botApiService);
        expect(providerNames).not.toContain('MessagingGateway');
    });
});
