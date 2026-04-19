import { BanListService, BanSubjectType } from './ban-list.service';
import { RedisService } from '../../../infrastructure/redis';

type RedisMock = jest.Mocked<
    Pick<RedisService, 'set' | 'del' | 'exists' | 'scan'>
>;

const makeRedisMock = (): RedisMock => ({
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(false),
    scan: jest.fn().mockResolvedValue({ cursor: '0', keys: [] }),
});

describe('BanListService', () => {
    let redis: RedisMock;
    let service: BanListService;

    beforeEach(() => {
        redis = makeRedisMock();
        service = new BanListService(redis as unknown as RedisService, {
            defaultTtlSec: 3600,
        });
    });

    describe('add()', () => {
        it('stores a ban with default TTL', async () => {
            await service.add({ type: 'session', value: 'sess-1' });
            expect(redis.set).toHaveBeenCalledWith(
                'ban:session:sess-1',
                '1',
                3600,
            );
        });

        it('uses custom ttlSec if provided', async () => {
            await service.add({ type: 'ip', value: '1.2.3.4', ttlSec: 120 });
            expect(redis.set).toHaveBeenCalledWith('ban:ip:1.2.3.4', '1', 120);
        });

        it('creates permanent ban when ttlSec <= 0', async () => {
            await service.add({
                type: 'fingerprint',
                value: 'fp-1',
                ttlSec: 0,
            });
            expect(redis.set).toHaveBeenCalledWith(
                'ban:fingerprint:fp-1',
                '1',
                undefined,
            );
        });

        it('rejects unknown type at runtime', async () => {
            await expect(
                service.add({ type: 'nope' as BanSubjectType, value: 'x' }),
            ).rejects.toThrow(/unknown ban subject type/i);
        });

        it('rejects empty value', async () => {
            await expect(
                service.add({ type: 'session', value: '' }),
            ).rejects.toThrow(/value is required/i);
        });
    });

    describe('remove()', () => {
        it('deletes the correct key', async () => {
            await service.remove({ type: 'chat', value: 'chat-1' });
            expect(redis.del).toHaveBeenCalledWith('ban:chat:chat-1');
        });
    });

    describe('isBanned()', () => {
        it('returns true if session is banned', async () => {
            redis.exists.mockResolvedValueOnce(true);
            const result = await service.isBanned({
                sessionId: 'sess-1',
            });
            expect(result).toBe(true);
            expect(redis.exists).toHaveBeenCalledWith('ban:session:sess-1');
        });

        it('returns true if any of subjects is banned (ip -> session -> fp -> chat order)', async () => {
            redis.exists
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true);
            const result = await service.isBanned({
                ip: '1.2.3.4',
                sessionId: 'sess-1',
                fingerprint: 'fp-1',
            });
            expect(result).toBe(true);
        });

        it('returns false if no subjects banned', async () => {
            redis.exists.mockResolvedValue(false);
            const result = await service.isBanned({
                ip: '1.2.3.4',
                sessionId: 'sess-1',
            });
            expect(result).toBe(false);
        });

        it('returns false if all subjects are undefined', async () => {
            const result = await service.isBanned({});
            expect(result).toBe(false);
            expect(redis.exists).not.toHaveBeenCalled();
        });
    });

    describe('list()', () => {
        it('returns all ban keys grouped by type via SCAN pagination', async () => {
            redis.scan
                .mockResolvedValueOnce({
                    cursor: '17',
                    keys: ['ban:ip:1.2.3.4'],
                })
                .mockResolvedValueOnce({
                    cursor: '0',
                    keys: [],
                })
                .mockResolvedValueOnce({
                    cursor: '0',
                    keys: ['ban:session:s1', 'ban:session:s2'],
                })
                .mockResolvedValueOnce({
                    cursor: '0',
                    keys: [],
                })
                .mockResolvedValueOnce({
                    cursor: '0',
                    keys: ['ban:chat:c1'],
                });
            const list = await service.list();
            expect(list).toEqual({
                ip: ['1.2.3.4'],
                session: ['s1', 's2'],
                fingerprint: [],
                chat: ['c1'],
            });
            expect(redis.scan).toHaveBeenNthCalledWith(1, '0', 'ban:ip:*', 100);
            expect(redis.scan).toHaveBeenNthCalledWith(2, '17', 'ban:ip:*', 100);
            expect(redis.scan).toHaveBeenNthCalledWith(
                3,
                '0',
                'ban:session:*',
                100,
            );
        });
    });
});
