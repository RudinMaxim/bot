import { MaxAdapterService } from '../../services/max-adapter.service';

describe('MaxAdapterService', () => {
    it('maps MAX incoming text updates into IncomingMessage', () => {
        const service = new MaxAdapterService();

        const normalized = service.normalizeUpdate({
            update_id: 101,
            message: {
                message_id: 'm-1',
                text: 'Какой статус заявки?',
                chat: { chat_id: 'chat-1', type: 'dialog' },
                from: { user_id: 'user-1', username: 'max-user' },
                timestamp: 1711111111,
            },
        });

        expect(normalized).toMatchObject({
            chatId: 'chat-1',
            userId: 'user-1',
            type: 'text',
            content: 'Какой статус заявки?',
            username: 'max-user',
        });
    });

    it('returns null for unsupported MAX updates', () => {
        const service = new MaxAdapterService();

        const normalized = service.normalizeUpdate({
            update_id: 102,
            callback_query: {
                callback_id: 'cb-1',
                chat_id: 'chat-1',
                data: 'noop',
                from: { user_id: 'user-1' },
            },
        });

        expect(normalized).toBeNull();
    });
});
