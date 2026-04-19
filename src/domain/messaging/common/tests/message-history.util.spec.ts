import { CachedMessageData, MessageType } from '../types';
import { buildMessageHistory } from '../utils/message-history.util';

describe('message-history.util', () => {
    const CHAT_ID = 'chat-1';

    const BASE_MESSAGE: CachedMessageData = {
        request: 'Привет',
        response: 'Здравствуйте',
        quickReplies: [
            {
                text: 'show_catalog',
                intent: 'explore_similar',
                priority: 1,
            },
        ],
        metadata: {
            sessionId: CHAT_ID,
            chatId: CHAT_ID,
            platform: 'web',
            userId: 'user-1',
            messageId: 'm-1',
            inputType: MessageType.TEXT,
            timestamp: '2026-01-01T10:00:00.000Z',
        },
    };

    it('creates user and assistant messages for cache entry', () => {
        const history = buildMessageHistory([BASE_MESSAGE], CHAT_ID);

        expect(history).toHaveLength(2);
        expect(history[0]).toMatchObject({
            messageId: 'm-1',
            content: 'Привет',
            type: MessageType.TEXT,
        });
        expect(history[0]).not.toHaveProperty('username');
        expect(history[1]).toMatchObject({
            messageId: 'm-1:assistant',
            content: 'Здравствуйте',
            quickReplies: [
                {
                    text: 'show_catalog',
                    intent: 'explore_similar',
                    priority: 1,
                },
            ],
        });
        expect(history[1]).not.toHaveProperty('username');
    });

    it('does not expose visuals or actions in assistant history message', () => {
        const history = buildMessageHistory(
            [
                {
                    ...BASE_MESSAGE,
                },
            ],
            CHAT_ID,
        );

        expect(history[1]).not.toHaveProperty('visuals');
    });

    it('deduplicates repeated cache entries by message id and author', () => {
        const history = buildMessageHistory(
            [BASE_MESSAGE, { ...BASE_MESSAGE }],
            CHAT_ID,
        );

        expect(history).toHaveLength(2);
    });

    it('returns only user message when assistant response is empty', () => {
        const history = buildMessageHistory(
            [{ ...BASE_MESSAGE, response: '' }],
            CHAT_ID,
        );

        expect(history).toHaveLength(1);
        expect(history[0]).toMatchObject({
            messageId: 'm-1',
            content: 'Привет',
        });
    });
});
