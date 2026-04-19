import { NestFactory, Reflector } from '@nestjs/core';
import {
    INestApplication,
    Module,
    VersioningType,
    ValidationPipe,
} from '@nestjs/common';
import type { Server } from 'node:http';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');
import { CookieSigner } from '../../src/shared/security/crypto/cookie-signer';
import { JwtSigner } from '../../src/shared/security/crypto/jwt-signer';
import { IdentityService } from '../../src/shared/security/services/identity.service';
import { ChatOwnershipService } from '../../src/shared/security/services/chat-ownership.service';
import { OwnershipGuard } from '../../src/shared/security/guards/ownership.guard';
import { SessionBootstrapController } from '../../src/shared/security/controllers/session-bootstrap.controller';
import { MessagingController } from '../../src/domain/messaging/controller/messaging.controller';
import {
    MessageService,
    SpeechSynthesisService,
} from '../../src/domain/messaging/services';
import type { SecurityConfig } from '../../src/shared/security/config/security.config.interface';
import { RedisService } from '../../src/infrastructure/redis';
import { createInMemoryRedisStub } from './helpers/in-memory-redis.stub';

/**
 * Cross-session ownership e2e for Phase 1.C.
 *
 * Boots `SessionBootstrapController` (so we can mint two real
 * cookie-bound identities) and `MessagingController` (so we can hit a
 * `@OwnsChat`-protected endpoint), backed by an in-memory Redis stub.
 * AppModule is intentionally NOT imported — that would pull in
 * Postgres / Redis / OpenRouter and turn this into a slow integration
 * test instead of a focused security check.
 *
 * Scenario:
 *  1. Bootstrap session A → cookie A, chatId A.
 *  2. Bootstrap session B → cookie B, chatId B.
 *  3. Cookie A reading its own chatId A → 200.
 *  4. Cookie B reading chatId A → 403 CHAT_NOT_OWNED.
 *  5. No cookie at all → 401 NO_IDENTITY.
 *  6. Same conflict on `DELETE /messaging/session/:chatId`.
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

const messageServiceMock = {
    processVoiceRequest: jest.fn(),
    handleFeedbackByKey: jest.fn(),
    getMessageHistory: jest.fn().mockResolvedValue([]),
    clearSessionAndHistory: jest.fn().mockResolvedValue({ clearedMessages: 0 }),
};

const speechSynthesisServiceMock = {
    synthesize: jest.fn(),
};

@Module({
    controllers: [SessionBootstrapController, MessagingController],
    providers: [
        Reflector,
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
        OwnershipGuard,
        { provide: MessageService, useValue: messageServiceMock },
        { provide: SpeechSynthesisService, useValue: speechSynthesisServiceMock },
    ],
})
class SecurityOwnershipTestModule {}

describe('Chat ownership (e2e)', () => {
    let app: INestApplication;
    let httpServer: Server;

    const bootstrap = async (): Promise<{
        cookie: string;
        chatId: string;
    }> => {
        const res = await request(httpServer)
            .get('/api/session/bootstrap')
            .expect(200);
        const setCookie = res.headers['set-cookie'] as unknown as
            | string[]
            | undefined;
        const cookie = (setCookie ?? [])
            .map((c) => c.split(';')[0])
            .find((c) => c.startsWith('dai_sid='));
        if (!cookie) throw new Error('no session cookie issued');
        return { cookie, chatId: res.body.chatId };
    };

    beforeAll(async () => {
        app = await NestFactory.create(SecurityOwnershipTestModule, {
            logger: false,
        });
        app.setGlobalPrefix('api');
        app.enableVersioning({ type: VersioningType.URI });
        app.useGlobalPipes(
            new ValidationPipe({ whitelist: true, transform: true }),
        );
        await app.init();
        httpServer = app.getHttpServer() as Server;
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        messageServiceMock.getMessageHistory.mockClear();
        messageServiceMock.clearSessionAndHistory.mockClear();
    });

    it('lets the owning session read its own chat history', async () => {
        const a = await bootstrap();
        const res = await request(httpServer)
            .get(`/api/v1/messaging/history?chatId=${a.chatId}`)
            .set('Cookie', a.cookie)
            .expect(200);
        expect(res.body).toEqual({ messages: [] });
        expect(messageServiceMock.getMessageHistory).toHaveBeenCalledWith(
            a.chatId,
            undefined,
        );
    });

    it('rejects another session reading the chatId with 403 CHAT_NOT_OWNED', async () => {
        const a = await bootstrap();
        const b = await bootstrap();
        const res = await request(httpServer)
            .get(`/api/v1/messaging/history?chatId=${a.chatId}`)
            .set('Cookie', b.cookie)
            .expect(403);
        expect(res.body).toMatchObject({ code: 'CHAT_NOT_OWNED' });
        expect(messageServiceMock.getMessageHistory).not.toHaveBeenCalled();
    });

    it('rejects an anonymous request with 401 NO_IDENTITY', async () => {
        const a = await bootstrap();
        const res = await request(httpServer)
            .get(`/api/v1/messaging/history?chatId=${a.chatId}`)
            .expect(401);
        expect(res.body).toMatchObject({ code: 'NO_IDENTITY' });
    });

    it('rejects DELETE /messaging/session/:chatId from a non-owning session', async () => {
        const a = await bootstrap();
        const b = await bootstrap();
        await request(httpServer)
            .delete(`/api/v1/messaging/session/${a.chatId}`)
            .set('Cookie', b.cookie)
            .expect(403);
        expect(messageServiceMock.clearSessionAndHistory).not.toHaveBeenCalled();
    });

    it('lets the owning session DELETE its own chat session', async () => {
        const a = await bootstrap();
        await request(httpServer)
            .delete(`/api/v1/messaging/session/${a.chatId}`)
            .set('Cookie', a.cookie)
            .expect(200);
        expect(messageServiceMock.clearSessionAndHistory).toHaveBeenCalledWith(
            a.chatId,
        );
    });

    it('rejects an unknown / orphan chatId even from a valid session', async () => {
        const a = await bootstrap();
        const res = await request(httpServer)
            .get('/api/v1/messaging/history?chatId=chat_unknown')
            .set('Cookie', a.cookie)
            .expect(403);
        expect(res.body).toMatchObject({ code: 'CHAT_NOT_OWNED' });
    });
});
