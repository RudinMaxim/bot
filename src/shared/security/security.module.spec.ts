import 'reflect-metadata';

process.env.POSTGRES_URL =
    process.env.POSTGRES_URL ||
    'postgres://postgres:postgres@postgres:5432/app';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
process.env.OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY || 'sk-or-test';
process.env.SESSION_SIGNING_KEY =
    process.env.SESSION_SIGNING_KEY ||
    'dev-session-signing-key-change-me-min-32-bytes-abcdef';
process.env.JWT_SIGNING_KEY =
    process.env.JWT_SIGNING_KEY ||
    'dev-jwt-signing-key-change-me-min-32-bytes-abcdef';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SecurityModule } = require('./security.module');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

describe('SecurityModule', () => {
    it('does not expose legacy session bootstrap controller in widget runtime', () => {
        const dynamicModule = SecurityModule.forRoot();
        const controllers: Array<{ name?: string }> = dynamicModule.controllers ?? [];
        const controllerNames = controllers.map((item) => item.name);

        expect(controllerNames).not.toContain('SessionBootstrapController');
    });

    it('does not force HTTPS upgrades when session cookies are configured for HTTP', async () => {
        const server = express();
        const fakeNestApp = {
            enableCors: jest.fn(),
            use: (middleware: unknown) => server.use(middleware),
        };

        SecurityModule.configure(fakeNestApp as never, {
            cors: {
                enabled: true,
                origins: ['http://195.24.71.214'],
            },
            security: {
                session: {
                    cookieSecure: false,
                },
            },
        } as never);

        server.get('/demo', (_req: unknown, res: { send: (body: string) => void }) =>
            res.send('<script src="./widget.js"></script>'),
        );

        const response = await request(server).get('/demo');

        expect(response.headers['content-security-policy']).not.toContain(
            'upgrade-insecure-requests',
        );
        expect(response.headers['strict-transport-security']).toBeUndefined();
    });
});
