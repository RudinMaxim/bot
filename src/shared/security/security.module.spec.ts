import 'reflect-metadata';

process.env.POSTGRES_URL =
    process.env.POSTGRES_URL ||
    'postgres://postgres:postgres@postgres:5432/app';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
process.env.OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY || 'sk-or-test';
process.env.MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || 'token';
process.env.MAX_WEBHOOK_SECRET = process.env.MAX_WEBHOOK_SECRET || 'secret';
process.env.SESSION_SIGNING_KEY =
    process.env.SESSION_SIGNING_KEY ||
    'dev-session-signing-key-change-me-min-32-bytes-abcdef';
process.env.JWT_SIGNING_KEY =
    process.env.JWT_SIGNING_KEY ||
    'dev-jwt-signing-key-change-me-min-32-bytes-abcdef';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SecurityModule } = require('./security.module');

describe('SecurityModule', () => {
    it('does not expose legacy session bootstrap controller in MAX-only runtime', () => {
        const dynamicModule = SecurityModule.forRoot();
        const controllers: Array<{ name?: string }> = dynamicModule.controllers ?? [];
        const controllerNames = controllers.map((item) => item.name);

        expect(controllerNames).not.toContain('SessionBootstrapController');
    });
});
