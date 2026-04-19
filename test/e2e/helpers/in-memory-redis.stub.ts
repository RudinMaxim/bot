import type { RedisService } from '../../../src/infrastructure/redis';

/**
 * Bare-minimum in-memory `RedisService` substitute for security e2e
 * tests that need real `ChatOwnershipService` semantics without
 * standing up a Redis container. Implements only the methods the
 * security layer actually calls (`set`, `get`, `del`, `setIfNotExists`)
 * and throws on anything else so accidental use is loud.
 */
export const createInMemoryRedisStub = (): RedisService => {
    const store = new Map<string, string>();

    const unsupported = (name: string) => () => {
        throw new Error(`in-memory Redis stub does not implement ${name}()`);
    };

    return {
        getClient: unsupported('getClient'),
        get: async <T>(key: string): Promise<T | null> => {
            const value = store.get(key);
            return (value ?? null) as T | null;
        },
        set: async (key, value) => {
            store.set(key, value);
        },
        del: async (key) => {
            const existed = store.delete(key);
            return existed ? 1 : 0;
        },
        keys: async () => Array.from(store.keys()),
        mget: async (keys) =>
            keys.map((key) => {
                const value = store.get(key);
                return value ?? null;
            }),
        mset: async (pairs: Record<string, string>) => {
            for (const [k, v] of Object.entries(pairs)) store.set(k, v);
        },
        incr: unsupported('incr'),
        decr: unsupported('decr'),
        expire: async () => true,
        ttl: async () => -1,
        exists: async (key) => store.has(key),
        scan: async () => ({ cursor: '0', keys: Array.from(store.keys()) }),
        lpush: unsupported('lpush'),
        rpop: unsupported('rpop'),
        llen: unsupported('llen'),
        rpoplpush: unsupported('rpoplpush'),
        lrem: unsupported('lrem'),
        lrange: unsupported('lrange'),
        sadd: unsupported('sadd'),
        smembers: unsupported('smembers'),
        srem: unsupported('srem'),
        setnx: unsupported('setnx'),
        setIfNotExists: async (key, value) => {
            if (store.has(key)) return false;
            store.set(key, value);
            return true;
        },
    } as unknown as RedisService;
};
