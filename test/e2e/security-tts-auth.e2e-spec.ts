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
import { IdentityGuard } from '../../src/shared/security/guards/identity.guard';
import { ChatOwnershipService } from '../../src/shared/security/services/chat-ownership.service';
import { SessionBootstrapController } from '../../src/shared/security/controllers/session-bootstrap.controller';
import { TtsController } from '../../src/domain/messaging/controller/tts.controller';
import { SpeechSynthesisService } from '../../src/domain/messaging/services';
import { RedisService } from '../../src/infrastructure/redis';
import type { SecurityConfig } from '../../src/shared/security/config/security.config.interface';
import { createInMemoryRedisStub } from './helpers/in-memory-redis.stub';

/**
 * P1.4 — public TTS endpoints must require widget identity.
 *
 * Boots `SessionBootstrapController` (so we can mint a real cookie/JWT
 * pair) and `TtsController` (which is the simplest TTS surface and is
 * now wrapped in `IdentityGuard`). The same guard guards
 * `MessagingController#synthesis`, so a single TTS controller is
 * enough to verify the contract change end-to-end.
 *
 * Scenarios:
 *  1. POST /tts without any cookie → 401 NO_IDENTITY (request never
 *     reaches the speech synthesis service).
 *  2. POST /tts with a valid bootstrapped cookie → 200, audio buffer
 *     returned, service called once.
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

const speechSynthesisServiceMock = {
    synthesize: jest.fn().mockResolvedValue({
        audio: Buffer.from('fake-audio-payload'),
        contentType: 'audio/wav',
    }),
};

@Module({
    controllers: [SessionBootstrapController, TtsController],
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
        IdentityGuard,
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
        { provide: SpeechSynthesisService, useValue: speechSynthesisServiceMock },
    ],
})
class TtsAuthTestModule {}

describe('TTS identity auth (e2e)', () => {
    let app: INestApplication;
    let httpServer: Server;

    beforeAll(async () => {
        app = await NestFactory.create(TtsAuthTestModule, { logger: false });
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
        speechSynthesisServiceMock.synthesize.mockClear();
    });

    it('rejects POST /tts without identity cookie with 401 NO_IDENTITY', async () => {
        const res = await request(httpServer)
            .post('/api/v1/tts')
            .send({ text: 'hello', lang: 'ru' })
            .expect(401);
        expect(res.body).toMatchObject({ code: 'NO_IDENTITY' });
        expect(speechSynthesisServiceMock.synthesize).not.toHaveBeenCalled();
    });

    it('accepts POST /tts with a bootstrapped widget cookie', async () => {
        const bootstrap = await request(httpServer)
            .get('/api/session/bootstrap')
            .expect(200);
        const setCookie = bootstrap.headers['set-cookie'] as unknown as
            | string[]
            | undefined;
        const cookie = (setCookie ?? [])
            .map((c) => c.split(';')[0])
            .find((c) => c.startsWith('dai_sid='));
        if (!cookie) throw new Error('no session cookie issued');

        const res = await request(httpServer)
            .post('/api/v1/tts')
            .set('Cookie', cookie)
            .send({ text: 'hello', lang: 'ru' })
            .expect(200);

        expect(res.headers['content-type']).toContain('audio/wav');
        expect(speechSynthesisServiceMock.synthesize).toHaveBeenCalledTimes(1);
    });
});
