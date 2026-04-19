import { MessageCacheRepository } from './message-cache.repository';
import type { RedisService } from 'src/infrastructure/redis/redis.config';

describe('MessageCacheRepository', () => {
    it('advances the SCAN cursor until Redis completes iteration', async () => {
        const redis = {
            scan: jest
                .fn()
                .mockResolvedValueOnce({
                    cursor: '42',
                    keys: ['messaging:cache:v1:chat_1:m1'],
                })
                .mockResolvedValueOnce({
                    cursor: '0',
                    keys: ['messaging:cache:v1:chat_1:m2'],
                }),
            mget: jest.fn().mockResolvedValue([
                JSON.stringify({
                    request: 'hello',
                    response: 'hi',
                    metadata: {
                        sessionId: 'sess_1',
                        chatId: 'chat_1',
                        platform: 'web',
                        userId: 'user_1',
                        messageId: 'm1',
                        timestamp: '2026-04-13T10:00:00.000Z',
                        inputType: 'text',
                    },
                }),
                JSON.stringify({
                    request: 'second',
                    response: 'reply',
                    metadata: {
                        sessionId: 'sess_1',
                        chatId: 'chat_1',
                        platform: 'web',
                        userId: 'user_1',
                        messageId: 'm2',
                        timestamp: '2026-04-13T10:01:00.000Z',
                        inputType: 'text',
                    },
                }),
            ]),
        } as unknown as jest.Mocked<Pick<RedisService, 'scan' | 'mget'>>;

        const repo = new MessageCacheRepository(redis as unknown as RedisService);

        const result = await repo.getMessagesByChat('chat_1');

        expect(redis.scan).toHaveBeenNthCalledWith(
            1,
            '0',
            'messaging:cache:v1:chat_1:*',
            100,
        );
        expect(redis.scan).toHaveBeenNthCalledWith(
            2,
            '42',
            'messaging:cache:v1:chat_1:*',
            100,
        );
        expect(result).toHaveLength(2);
        expect(result[0]?.metadata.messageId).toBe('m2');
        expect(result[1]?.metadata.messageId).toBe('m1');
    });
});
