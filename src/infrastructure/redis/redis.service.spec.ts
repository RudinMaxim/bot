import { RedisServiceImpl } from './redis.service';

describe('RedisServiceImpl', () => {
    it('passes the incoming cursor to Redis SCAN', async () => {
        const redisClient = {
            scan: jest.fn().mockResolvedValue(['13', ['key:1', 'key:2']]),
        };

        const service = new RedisServiceImpl(redisClient as any);

        const result = await (service as any).scan('7', 'chat:*', 100);

        expect(redisClient.scan).toHaveBeenCalledWith(
            '7',
            'MATCH',
            'chat:*',
            'COUNT',
            100,
        );
        expect(result).toEqual({
            cursor: '13',
            keys: ['key:1', 'key:2'],
        });
    });
});
