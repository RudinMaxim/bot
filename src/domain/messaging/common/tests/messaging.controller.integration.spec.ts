import 'reflect-metadata';
import {
    INestApplication,
    Module,
    ValidationPipe,
    VersioningType,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AddressInfo } from 'net';
import { MessagingController, TtsController } from '../../controller';
import { MessageService, SpeechSynthesisService } from '../../services';
import { MessageStatus } from '../types';
import {
    ChatOwnershipService,
    IdentityService,
    OwnershipGuard,
} from 'src/shared/security';

type JsonResponse<T = unknown> = {
    status: number;
    body: T;
};

const messageServiceMock = {
    processVoiceRequest: jest.fn(),
    handleFeedbackByKey: jest.fn(),
    getMessageHistory: jest.fn(),
    clearSessionAndHistory: jest.fn(),
};

const speechSynthesisServiceMock = {
    synthesize: jest.fn(),
};

// The controller now uses @UseGuards(OwnershipGuard) on the chat-bound
// endpoints. This integration test focuses on controller wiring rather
// than authorization, so we provide stub IdentityService /
// ChatOwnershipService implementations that always succeed and let the
// real OwnershipGuard instantiate against them.
const stubIdentityService = {
    resolve: () => ({
        sessionId: 'test-session',
        source: 'cookie',
        issuedAt: 0,
    }),
};

const stubChatOwnership = {
    bind: jest.fn().mockResolvedValue(undefined),
    assertOwned: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
};

@Module({
    controllers: [MessagingController, TtsController],
    providers: [
        {
            provide: MessageService,
            useValue: messageServiceMock,
        },
        {
            provide: SpeechSynthesisService,
            useValue: speechSynthesisServiceMock,
        },
        {
            provide: IdentityService,
            useValue: stubIdentityService,
        },
        {
            provide: ChatOwnershipService,
            useValue: stubChatOwnership,
        },
        OwnershipGuard,
    ],
})
class MessagingControllerIntegrationModule {}

const VOICE_ENDPOINT = '/api/v1/messaging/voice';
const TTS_ENDPOINT = '/api/v1/tts';
const FEEDBACK_ENDPOINT = '/api/v1/messaging/feedback';
const HISTORY_ENDPOINT = '/api/v1/messaging/history';
const SESSION_ENDPOINT = '/api/v1/messaging/session';

describe('MessagingController (integration)', () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
        app = await NestFactory.create(MessagingControllerIntegrationModule, {
            logger: false,
        });

        app.setGlobalPrefix('api');
        app.enableVersioning({
            type: VersioningType.URI,
        });
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                transform: true,
                forbidNonWhitelisted: true,
                validationError: { target: false, value: true },
            }),
        );

        await app.listen(0, '127.0.0.1');

        const address = app.getHttpServer().address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('POST /voice returns 201 with payload when processing succeeds', async () => {
        messageServiceMock.processVoiceRequest.mockResolvedValue({
            processed: {
                status: MessageStatus.COMPLETED,
            },
            payload: {
                messageId: 'web_1',
                response: 'ok',
                status: MessageStatus.COMPLETED,
                quickReplies: [],
            },
        });

        const response = await requestJson(baseUrl, 'POST', VOICE_ENDPOINT, {
            body: {
                chatId: 'chat_1',
                username: 'alice',
                audio: {
                    base64: 'ZGF0YQ==',
                    mimeType: 'audio/webm',
                    durationMs: 1000,
                },
            },
            metadata: {
                locale: 'en',
                platform: 'web',
            },
        });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            success: true,
            message: 'OK',
            data: {
                messageId: 'web_1',
                response: 'ok',
                status: MessageStatus.COMPLETED,
                quickReplies: [],
            },
        });
    });

    it('POST /voice returns 400 when service marks message as failed', async () => {
        messageServiceMock.processVoiceRequest.mockResolvedValue({
            processed: {
                status: MessageStatus.FAILED,
            },
            payload: {
                messageId: 'web_1',
                response: 'recognition_failed',
                status: MessageStatus.FAILED,
                quickReplies: [],
            },
        });

        const response = await requestJson(baseUrl, 'POST', VOICE_ENDPOINT, {
            body: {
                chatId: 'chat_1',
                audio: {
                    base64: 'ZGF0YQ==',
                    mimeType: 'audio/webm',
                    durationMs: 1000,
                },
            },
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
            statusCode: 400,
            message: 'recognition_failed',
        });
    });

    it('POST /voice returns 400 when processing is cancelled', async () => {
        messageServiceMock.processVoiceRequest.mockResolvedValue({
            processed: {
                status: MessageStatus.CANCELLED,
            },
            payload: {
                messageId: 'web_1',
                response: '',
                status: MessageStatus.CANCELLED,
                quickReplies: [],
            },
        });

        const response = await requestJson(baseUrl, 'POST', VOICE_ENDPOINT, {
            body: {
                chatId: 'chat_1',
                audio: {
                    base64: 'ZGF0YQ==',
                    mimeType: 'audio/webm',
                    durationMs: 1000,
                },
            },
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
            statusCode: 400,
            message: 'Voice message processing was cancelled',
        });
    });

    it('POST /voice returns 400 for unsupported audio format errors', async () => {
        messageServiceMock.processVoiceRequest.mockRejectedValue(
            new Error('Unsupported audio format'),
        );

        const response = await requestJson(baseUrl, 'POST', VOICE_ENDPOINT, {
            body: {
                chatId: 'chat_1',
                audio: {
                    base64: 'ZGF0YQ==',
                    mimeType: 'audio/unknown',
                    durationMs: 1000,
                },
            },
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
            statusCode: 400,
            message: 'Unsupported audio format',
        });
    });

    it('POST /voice returns 500 for unexpected errors', async () => {
        messageServiceMock.processVoiceRequest.mockRejectedValue(
            new Error('boom'),
        );

        const response = await requestJson(baseUrl, 'POST', VOICE_ENDPOINT, {
            body: {
                chatId: 'chat_1',
                audio: {
                    base64: 'ZGF0YQ==',
                    mimeType: 'audio/webm',
                    durationMs: 1000,
                },
            },
        });

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
            statusCode: 500,
            message: 'Failed to send voice message',
        });
    });

    it('POST /voice returns 400 for invalid DTO payload', async () => {
        const response = await requestJson(baseUrl, 'POST', VOICE_ENDPOINT, {
            body: {
                chatId: 'chat_1',
                audio: {
                    base64: '',
                    mimeType: '',
                    durationMs: 'invalid',
                },
            },
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
            statusCode: 400,
        });
        expect(
            Array.isArray((response.body as { message?: unknown }).message),
        ).toBe(true);
        expect(messageServiceMock.processVoiceRequest).not.toHaveBeenCalled();
    });

    it('POST /tts returns WAV bytes when synthesis succeeds', async () => {
        speechSynthesisServiceMock.synthesize.mockResolvedValue({
            audio: Buffer.from('wav-binary'),
            contentType: 'audio/wav',
            voice: 'marina',
            role: 'friendly',
        });

        const response = await requestBinary(baseUrl, TTS_ENDPOINT, {
            text: 'Привет',
            lang: 'ru',
        });

        expect(response.status).toBe(200);
        expect(response.contentType).toContain('audio/wav');
        expect(response.cacheControl).toBe('no-store');
        expect(response.body.equals(Buffer.from('wav-binary'))).toBe(true);
        expect(speechSynthesisServiceMock.synthesize).toHaveBeenCalledWith({
            text: 'Привет',
            lang: 'ru',
        });
    });

    it('POST /tts returns 400 for invalid DTO payload', async () => {
        const response = await requestJson(baseUrl, 'POST', TTS_ENDPOINT, {
            text: '',
            lang: 'de',
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
            statusCode: 400,
        });
        expect(speechSynthesisServiceMock.synthesize).not.toHaveBeenCalled();
    });

    it('POST /tts returns upstream status when synthesis fails', async () => {
        speechSynthesisServiceMock.synthesize.mockRejectedValue(
            Object.assign(new Error('SpeechKit access denied'), {
                status: 403,
            }),
        );

        const response = await requestJson(baseUrl, 'POST', TTS_ENDPOINT, {
            text: 'hello',
            lang: 'en',
        });

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
            statusCode: 403,
            message: 'SpeechKit access denied',
        });
    });

    it('POST /feedback returns 200 when feedback is saved', async () => {
        messageServiceMock.handleFeedbackByKey.mockResolvedValue('saved');

        const response = await requestJson(baseUrl, 'POST', FEEDBACK_ENDPOINT, {
            key: 'chat_1:web_1',
            feedback: 1,
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            success: true,
            message: 'Feedback saved',
            data: { saved: true },
        });
    });

    it('POST /feedback returns 400 when key format is invalid after parsing', async () => {
        messageServiceMock.handleFeedbackByKey.mockResolvedValue('invalid_key');

        const response = await requestJson(baseUrl, 'POST', FEEDBACK_ENDPOINT, {
            key: 'chat_1:web_1',
            feedback: 1,
        });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
            statusCode: 400,
            message: 'Invalid key format, expected chatId:messageId',
        });
    });

    it('POST /feedback returns 404 when target message is missing', async () => {
        messageServiceMock.handleFeedbackByKey.mockResolvedValue('not_found');

        const response = await requestJson(baseUrl, 'POST', FEEDBACK_ENDPOINT, {
            key: 'chat_1:web_1',
            feedback: 0,
        });

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({
            statusCode: 404,
            message: 'Message for feedback was not found',
        });
    });

    it('POST /feedback returns 400 for a feedbackKey missing the chatId:messageId separator', async () => {
        const response = await requestJson(baseUrl, 'POST', FEEDBACK_ENDPOINT, {
            key: 'broken_key',
            feedback: 1,
        });

        // OwnershipGuard rejects before the controller body executes,
        // because it cannot extract a chatId from the malformed key.
        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
            code: 'BAD_CHAT_ID',
            message: 'chatId is required',
        });
        expect(messageServiceMock.handleFeedbackByKey).not.toHaveBeenCalled();
    });

    it('POST /feedback returns 500 on unexpected error', async () => {
        messageServiceMock.handleFeedbackByKey.mockRejectedValue(
            new Error('redis_down'),
        );

        const response = await requestJson(baseUrl, 'POST', FEEDBACK_ENDPOINT, {
            key: 'chat_1:web_1',
            feedback: 1,
        });

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
            statusCode: 500,
            message: 'Failed to process feedback',
        });
    });

    it('GET /history returns messages and caps limit to 100', async () => {
        messageServiceMock.getMessageHistory.mockResolvedValue([
            {
                id: 'm1',
                chatId: 'chat_1',
                messageId: 'web_1',
                request: 'hello',
                response: 'hi',
                timestamp: new Date().toISOString(),
            },
        ]);

        const response = await requestJson(
            baseUrl,
            'GET',
            `${HISTORY_ENDPOINT}?chatId=chat_1&limit=999`,
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            messages: [
                {
                    id: 'm1',
                    chatId: 'chat_1',
                },
            ],
        });
        expect(messageServiceMock.getMessageHistory).toHaveBeenCalledWith(
            'chat_1',
            100,
        );
    });

    it('GET /history returns 400 when chatId is missing', async () => {
        const response = await requestJson(baseUrl, 'GET', HISTORY_ENDPOINT);

        // OwnershipGuard runs before the controller body and rejects
        // the request because there is nothing to verify ownership of.
        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
            code: 'BAD_CHAT_ID',
            message: 'chatId is required',
        });
        expect(messageServiceMock.getMessageHistory).not.toHaveBeenCalled();
    });

    it('GET /history returns 500 on service failure', async () => {
        messageServiceMock.getMessageHistory.mockRejectedValue(
            new Error('redis_down'),
        );

        const response = await requestJson(
            baseUrl,
            'GET',
            `${HISTORY_ENDPOINT}?chatId=chat_1&limit=10`,
        );

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
            statusCode: 500,
            message: 'Failed to fetch message history',
        });
    });

    it('DELETE /session/:chatId returns cleared count', async () => {
        messageServiceMock.clearSessionAndHistory.mockResolvedValue({
            clearedMessages: 3,
        });

        const response = await requestJson(
            baseUrl,
            'DELETE',
            `${SESSION_ENDPOINT}/chat_1`,
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            success: true,
            message: 'Session cleared',
            data: {
                clearedMessages: 3,
            },
        });
    });

    it('DELETE /session/:chatId returns 500 on service failure', async () => {
        messageServiceMock.clearSessionAndHistory.mockRejectedValue(
            new Error('clear_failed'),
        );

        const response = await requestJson(
            baseUrl,
            'DELETE',
            `${SESSION_ENDPOINT}/chat_1`,
        );

        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
            statusCode: 500,
            message: 'Failed to clear session',
        });
    });
});

async function requestJson(
    baseUrl: string,
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
): Promise<JsonResponse> {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            'content-type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const raw = await response.text();
    let parsed: unknown = {};

    if (raw) {
        try {
            parsed = JSON.parse(raw);
        } catch {
            parsed = raw;
        }
    }

    return {
        status: response.status,
        body: parsed,
    };
}

async function requestBinary(
    baseUrl: string,
    path: string,
    body: unknown,
): Promise<{
    status: number;
    body: Buffer;
    contentType: string | null;
    cacheControl: string | null;
}> {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const arrayBuffer = await response.arrayBuffer();

    return {
        status: response.status,
        body: Buffer.from(arrayBuffer),
        contentType: response.headers.get('content-type'),
        cacheControl: response.headers.get('cache-control'),
    };
}
