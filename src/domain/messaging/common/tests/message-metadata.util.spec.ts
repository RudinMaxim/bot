import { IncomingMessage, MessageType } from '../types';
import {
    buildCanonicalMetadata,
    sanitizeMessageMetadata,
} from '../utils/message-metadata.util';

describe('message-metadata.util', () => {
    const BASE_DATE = new Date('2026-01-01T10:00:00.000Z');

    const BASE_MESSAGE: IncomingMessage = {
        messageId: 'm-1',
        chatId: 'chat-1',
        userId: 'user-1',
        type: MessageType.TEXT,
        content: 'hello',
        timestamp: BASE_DATE,
        metadata: {
            platform: 'web',
            locale: 'ru',
            extras: {
                currentUrl: 'https://example.com',
            },
        },
    };

    it('keeps canonical ids from incoming message', () => {
        const metadata = buildCanonicalMetadata(BASE_MESSAGE, {
            chatId: 'override-chat',
            sessionId: 'override-session',
            userId: 'override-user',
            messageId: 'override-message',
        });

        expect(metadata.chatId).toBe('chat-1');
        expect(metadata.sessionId).toBe('chat-1');
        expect(metadata.userId).toBe('user-1');
        expect(metadata.messageId).toBe('m-1');
        expect(metadata).not.toHaveProperty('username');
    });

    it('keeps custom metadata and sanitizes undefined extras fields', () => {
        const metadata = buildCanonicalMetadata(BASE_MESSAGE, {
            triggeredBy: 'cancel_generation',
            extras: {
                requestId: 'r-1',
                skip: undefined,
            },
        });

        expect(metadata.triggeredBy).toBe('cancel_generation');
        expect(metadata.extras).toEqual({ requestId: 'r-1' });
    });

    it('uses provided fallback platform when metadata platform is missing', () => {
        const metadata = buildCanonicalMetadata(
            { ...BASE_MESSAGE, metadata: undefined },
            {},
            'websocket',
        );

        expect(metadata.platform).toBe('websocket');
    });

    it('drops empty extras in sanitizeMessageMetadata', () => {
        const metadata = sanitizeMessageMetadata({
            chatId: 'chat-1',
            sessionId: 'chat-1',
            platform: 'web',
            userId: 'user-1',
            messageId: 'm-1',
            inputType: MessageType.TEXT,
            timestamp: BASE_DATE.toISOString(),
            extras: {
                nullable: undefined,
            },
        });

        expect(metadata.extras).toBeUndefined();
    });
});
