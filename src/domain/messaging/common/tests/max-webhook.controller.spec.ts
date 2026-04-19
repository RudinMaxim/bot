import 'reflect-metadata';
import { INestApplication, Module, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { MaxAdapterService } from '../../services/max-adapter.service';
import { MaxBotApiService } from '../../services/max-bot-api.service';
import { SecretsConfig } from 'src/infrastructure/config/interfaces';

process.env.POSTGRES_URL =
    process.env.POSTGRES_URL ||
    'postgres://postgres:postgres@postgres:5432/app';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
process.env.OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY || 'sk-or-test';
process.env.MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || 'token';
process.env.MAX_WEBHOOK_SECRET = process.env.MAX_WEBHOOK_SECRET || 'secret';

// Delayed require keeps the test isolated from config bootstrap validation.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MaxWebhookController } = require('../../controller/max-webhook.controller');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MessageService } = require('../../services/message.service');

const adapterMock = {
    normalizeUpdate: jest.fn(),
};

const messageServiceMock = {
    handleMessage: jest.fn(),
};

const maxBotApiMock = {
    sendMessage: jest.fn(),
};

const secretsConfigMock: SecretsConfig = {
    redis: {} as never,
    rateLimit: {} as never,
    cors: {} as never,
    max: {
        botToken: 'token',
        apiBaseUrl: 'https://platform-api.max.ru',
        webhookSecret: 'secret',
        webhookPath: '/api/v1/max/webhook',
    },
    ai: {} as never,
    realEstate: {} as never,
    locales: {} as never,
    postgres: {} as never,
    embedding: {} as never,
    metrics: {} as never,
    retention: {} as never,
    security: {} as never,
};

@Module({
    controllers: [MaxWebhookController],
    providers: [
        {
            provide: MaxAdapterService,
            useValue: adapterMock,
        },
        {
            provide: MessageService,
            useValue: messageServiceMock,
        },
        {
            provide: MaxBotApiService,
            useValue: maxBotApiMock,
        },
        {
            provide: SecretsConfig,
            useValue: secretsConfigMock,
        },
    ],
})
class MaxWebhookControllerTestModule {}

describe('MaxWebhookController', () => {
    let app: INestApplication;

    beforeAll(async () => {
        app = await NestFactory.create(MaxWebhookControllerTestModule, {
            logger: false,
        });
        app.setGlobalPrefix('api');
        app.enableVersioning({
            type: VersioningType.URI,
        });
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects webhook requests with an invalid MAX secret', async () => {
        await request(app.getHttpServer())
            .post('/api/v1/max/webhook')
            .set('x-max-secret', 'wrong')
            .send({ update_id: 1 })
            .expect(401);
    });

    it('processes supported webhook updates and sends a reply', async () => {
        adapterMock.normalizeUpdate.mockReturnValue({
            messageId: 'm-1',
            chatId: 'chat-1',
            userId: 'user-1',
            type: 'text',
            content: 'Какой статус заявки?',
            timestamp: new Date('2026-04-19T00:00:00.000Z'),
        });
        messageServiceMock.handleMessage.mockResolvedValue({
            response: 'По базе знаний нашёлся такой порядок: ...',
        });
        maxBotApiMock.sendMessage.mockResolvedValue('out-1');

        await request(app.getHttpServer())
            .post('/api/v1/max/webhook')
            .set('x-max-secret', 'secret')
            .send({ update_id: 2, message: { text: 'Какой статус заявки?' } })
            .expect(201)
            .expect({ ok: true });

        expect(messageServiceMock.handleMessage).toHaveBeenCalledTimes(1);
        expect(maxBotApiMock.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                chatId: 'chat-1',
                content: 'По базе знаний нашёлся такой порядок: ...',
                replyToMessageId: 'm-1',
            }),
        );
    });
});
