import {
    ChatNotOwnedError,
    ChatOwnershipConflictError,
    ChatOwnershipService,
} from './chat-ownership.service';
import { RedisService } from '../../../infrastructure/redis';

type RedisMock = jest.Mocked<
    Pick<RedisService, 'setIfNotExists' | 'get' | 'set' | 'del'>
>;

const makeRedisMock = (): RedisMock => ({
    setIfNotExists: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(1),
});

describe('ChatOwnershipService', () => {
    let redis: RedisMock;
    let service: ChatOwnershipService;

    beforeEach(() => {
        redis = makeRedisMock();
        service = new ChatOwnershipService(redis as unknown as RedisService);
    });

    describe('bind()', () => {
        it('atomically writes chatId → sessionId with TTL', async () => {
            await service.bind('chat_a', 'sess_1', 3600);
            expect(redis.setIfNotExists).toHaveBeenCalledWith(
                'chat:owner:chat_a',
                'sess_1',
                3600,
            );
            expect(redis.set).toHaveBeenCalledWith(
                'session:chat:sess_1',
                'chat_a',
                3600,
            );
        });

        it('is idempotent when re-called from the same session', async () => {
            redis.setIfNotExists.mockResolvedValue(false);
            redis.get.mockResolvedValue('sess_1');
            await expect(
                service.bind('chat_a', 'sess_1', 3600),
            ).resolves.toBeUndefined();
            expect(redis.set).toHaveBeenCalledWith(
                'chat:owner:chat_a',
                'sess_1',
                3600,
            );
            expect(redis.set).toHaveBeenCalledWith(
                'session:chat:sess_1',
                'chat_a',
                3600,
            );
        });

        it('throws ChatOwnershipConflictError on collision', async () => {
            redis.setIfNotExists.mockResolvedValue(false);
            redis.get.mockResolvedValue('sess_other');
            await expect(
                service.bind('chat_a', 'sess_1', 3600),
            ).rejects.toBeInstanceOf(ChatOwnershipConflictError);
        });
    });

    describe('assertOwned()', () => {
        it('resolves when sessionId matches the recorded owner', async () => {
            redis.get.mockResolvedValue('sess_1');
            await expect(
                service.assertOwned('chat_a', 'sess_1'),
            ).resolves.toBeUndefined();
            expect(redis.get).toHaveBeenCalledWith('chat:owner:chat_a');
        });

        it('throws ChatNotOwnedError on mismatch', async () => {
            redis.get.mockResolvedValue('sess_other');
            await expect(
                service.assertOwned('chat_a', 'sess_1'),
            ).rejects.toBeInstanceOf(ChatNotOwnedError);
        });

        it('throws ChatNotOwnedError when no mapping exists', async () => {
            redis.get.mockResolvedValue(null);
            await expect(
                service.assertOwned('chat_a', 'sess_1'),
            ).rejects.toBeInstanceOf(ChatNotOwnedError);
        });
    });

    describe('getChatIdBySession()', () => {
        it('returns the chatId currently bound to the session', async () => {
            redis.get.mockResolvedValue('chat_a');
            await expect(service.getChatIdBySession('sess_1')).resolves.toBe(
                'chat_a',
            );
            expect(redis.get).toHaveBeenCalledWith('session:chat:sess_1');
        });
    });

    describe('release()', () => {
        it('deletes the mapping when caller is the owner', async () => {
            redis.get.mockResolvedValue('sess_1');
            await service.release('chat_a', 'sess_1');
            expect(redis.del).toHaveBeenCalledWith('chat:owner:chat_a');
            expect(redis.del).toHaveBeenCalledWith('session:chat:sess_1');
        });

        it('is a no-op when caller is not the owner', async () => {
            redis.get.mockResolvedValue('sess_other');
            await service.release('chat_a', 'sess_1');
            expect(redis.del).not.toHaveBeenCalled();
        });

        it('is a no-op when the mapping is already gone', async () => {
            redis.get.mockResolvedValue(null);
            await service.release('chat_a', 'sess_1');
            expect(redis.del).not.toHaveBeenCalled();
        });
    });
});
