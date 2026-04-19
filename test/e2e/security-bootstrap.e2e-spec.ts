import { NestFactory } from '@nestjs/core';
import { INestApplication, Module, VersioningType } from '@nestjs/common';
import type { Server } from 'node:http';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');
import { CookieSigner } from '../../src/shared/security/crypto/cookie-signer';
import { JwtSigner } from '../../src/shared/security/crypto/jwt-signer';
import { IdentityService } from '../../src/shared/security/services/identity.service';
import { ChatOwnershipService } from '../../src/shared/security/services/chat-ownership.service';
import { SessionBootstrapController } from '../../src/shared/security/controllers/session-bootstrap.controller';
import type { SecurityConfig } from '../../src/shared/security/config/security.config.interface';
import { RedisService } from '../../src/infrastructure/redis';
import { createInMemoryRedisStub } from './helpers/in-memory-redis.stub';

/**
 * Isolated e2e: boots only the SessionBootstrapController and its direct
 * dependencies. We deliberately do NOT import AppModule — that would pull in
 * Postgres/Redis/OpenRouter and make the test depend on external services.
 * The endpoint's behavior is self-contained (cookie signer + JWT), so a
 * minimal module is enough to verify the HTTP contract.
 */

const TEST_SECURITY_CONFIG: SecurityConfig = {
    session: {
        signingKey: 'test-signing-key-min-32-bytes-xxxxxxxxxxxx',
        cookieName: 'dai_sid',
        cookieDomain: undefined,
        cookieMaxAgeSec: 86_400,
        cookieSameSite: 'none',
        cookieSecure: true,
    },
    jwt: {
        signingKey: 'test-jwt-signing-key-min-32-bytes-xxxxxxxxx',
        ttlSec: 3_600,
        issuer: 'test',
    },
    ban: {
        defaultTtlSec: 3_600,
    },
    integration: {
        apiKeys: [],
    },
};

@Module({
    controllers: [SessionBootstrapController],
    providers: [
        {
            provide: CookieSigner,
            useFactory: () =>
                new CookieSigner(TEST_SECURITY_CONFIG.session.signingKey),
        },
        {
            provide: JwtSigner,
            useFactory: () =>
                new JwtSigner({
                    key: TEST_SECURITY_CONFIG.jwt.signingKey,
                    ttlSec: TEST_SECURITY_CONFIG.jwt.ttlSec,
                    issuer: TEST_SECURITY_CONFIG.jwt.issuer,
                }),
        },
        {
            provide: IdentityService,
            inject: [CookieSigner, JwtSigner],
            useFactory: (cookieSigner: CookieSigner, jwtSigner: JwtSigner) =>
                new IdentityService(
                    TEST_SECURITY_CONFIG,
                    cookieSigner,
                    jwtSigner,
                ),
        },
        {
            provide: RedisService,
            useFactory: () => createInMemoryRedisStub(),
        },
        {
            provide: ChatOwnershipService,
            inject: [RedisService],
            useFactory: (redis: RedisService) =>
                new ChatOwnershipService(redis),
        },
    ],
})
class SecurityBootstrapTestModule {}

describe('GET /api/session/bootstrap (e2e)', () => {
    let app: INestApplication;

    const extractCookie = (res: request.Response): string => {
        const setCookie = res.headers['set-cookie'] as unknown as
            | string[]
            | undefined;
        const cookieHeader = (setCookie ?? [])
            .map((value) => value.split(';')[0])
            .find((value) => value.startsWith('dai_sid='));
        if (!cookieHeader) {
            throw new Error('no session cookie issued');
        }
        return cookieHeader;
    };

    beforeAll(async () => {
        app = await NestFactory.create(SecurityBootstrapTestModule, {
            logger: false,
        });
        app.setGlobalPrefix('api');
        app.enableVersioning({ type: VersioningType.URI });
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns sessionId, chatId, jwt, expiresInSec and sets signed cookie', async () => {
        const res = await request(app.getHttpServer() as Server)
            .get('/api/session/bootstrap')
            .expect(200);

        expect(res.body.sessionId).toMatch(/^[0-9a-f-]{36}$/);
        expect(res.body.chatId).toMatch(/^chat_[0-9a-f-]{36}$/);
        expect(res.body.jwt).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
        expect(res.body.expiresInSec).toBe(86_400);

        const setCookie = res.headers['set-cookie'] as unknown as
            | string[]
            | undefined;
        expect(setCookie).toBeDefined();
        const cookieHeader = (setCookie ?? []).find((c) =>
            c.startsWith('dai_sid='),
        );
        expect(cookieHeader).toBeDefined();
        expect(cookieHeader).toMatch(/HttpOnly/i);
        expect(cookieHeader).toMatch(/SameSite=None/i);
        expect(cookieHeader).toMatch(/Secure/i);
    });

    it('reuses the existing sessionId and chatId when bootstrap is called with the same cookie', async () => {
        const a = await request(app.getHttpServer() as Server)
            .get('/api/session/bootstrap')
            .expect(200);
        const cookie = extractCookie(a);
        const b = await request(app.getHttpServer() as Server)
            .get('/api/session/bootstrap')
            .set('Cookie', cookie)
            .expect(200);
        expect(a.body.sessionId).toBe(b.body.sessionId);
        expect(a.body.chatId).toBe(b.body.chatId);
    });

    it('issues a different sessionId and chatId on anonymous calls', async () => {
        const a = await request(app.getHttpServer() as Server)
            .get('/api/session/bootstrap')
            .expect(200);
        const b = await request(app.getHttpServer() as Server)
            .get('/api/session/bootstrap')
            .expect(200);
        expect(a.body.sessionId).not.toBe(b.body.sessionId);
        expect(a.body.chatId).not.toBe(b.body.chatId);
    });
});
