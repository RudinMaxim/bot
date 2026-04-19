import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis, { Callback } from 'ioredis';
import { REDIS_CLIENT, RedisService } from './redis.config';

@Injectable()
export class RedisServiceImpl implements RedisService, OnModuleDestroy {
    constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

    /**
     * Returns the Redis client instance
     * @returns {Promise<Redis>} Redis client instance
     */
    getClient(): Redis {
        return this.redisClient;
    }

    /**
     * Retrieves a value by key from Redis
     * @param {string} key - The key to retrieve
     * @returns {Promise<string | null>} The value associated with the key, or null if not found
     */
    async get<T = any>(key: string): Promise<T | null> {
        const value = await this.redisClient.get(key);

        return value as T;
    }

    /**
     * Sets a value in Redis with an optional TTL
     * @param {string} key - The key to set
     * @param {string} value - The value to store
     * @param {number} [ttl] - Time to live in seconds
     * @returns {Promise<void>}
     */
    async set(key: string, value: string, ttl?: number): Promise<void> {
        if (ttl) {
            await this.redisClient.set(key, value, 'EX', ttl);
        } else {
            await this.redisClient.set(key, value);
        }
    }

    /**
     * Deletes a key from Redis
     * @param {string} key - The key to delete
     * @returns {Promise<number>}
     */
    async del(key: string): Promise<number> {
        return await this.redisClient.del(key);
    }

    async setnx(
        key: string,
        value: string | Buffer | number,
        callback?: Callback<number>,
    ): Promise<number> {
        if (callback) {
            return this.redisClient.setnx(key, value, callback);
        }
        return this.redisClient.setnx(key, value);
    }

    async setIfNotExists(
        key: string,
        value: string,
        ttlSeconds: number,
    ): Promise<boolean> {
        const result = await this.redisClient.set(
            key,
            value,
            'EX',
            ttlSeconds,
            'NX',
        );
        return result === 'OK';
    }

    /**
     * Retrieves all keys matching a pattern
     * @param {string} pattern - Pattern to match keys against
     * @returns {Promise<string[]>} Array of matching keys
     */
    async keys(pattern: string): Promise<string[]> {
        return this.redisClient.keys(pattern);
    }

    /**
     * Retrieves multiple values by keys
     * @param {string[]} keys - Array of keys to retrieve
     * @returns {Promise<(string | null)[]>} Array of values in the same order as keys
     */
    async mget(keys: string[]): Promise<(string | null)[]> {
        return this.redisClient.mget(keys);
    }

    /**
     * Sets multiple key-value pairs atomically
     * @param {Record<string, string>} keyValuePairs - Object containing key-value pairs
     * @returns {Promise<void>}
     */
    async mset(keyValuePairs: Record<string, string>): Promise<void> {
        const pairs = Object.entries(keyValuePairs).flat();
        await this.redisClient.mset(pairs);
    }

    /**
     * Increments the number stored at key by one
     * @param {string} key - The key to increment
     * @returns {Promise<number>} The value after increment
     */
    async incr(key: string): Promise<number> {
        return this.redisClient.incr(key);
    }

    /**
     * Decrements the number stored at key by one
     * @param {string} key - The key to decrement
     * @returns {Promise<number>} The value after decrement
     */
    async decr(key: string): Promise<number> {
        return this.redisClient.decr(key);
    }

    /**
     * Sets a timeout on key
     * @param {string} key - The key to set timeout on
     * @param {number} seconds - Number of seconds until expiration
     * @returns {Promise<boolean>} True if timeout was set, false otherwise
     */
    async expire(key: string, seconds: number): Promise<boolean> {
        const result = await this.redisClient.expire(key, seconds);
        return result === 1;
    }

    /**
     * Gets the remaining time to live of a key
     * @param {string} key - The key to check
     * @returns {Promise<number>} TTL in seconds, -2 if key doesn't exist, -1 if no timeout
     */
    async ttl(key: string): Promise<number> {
        return this.redisClient.ttl(key);
    }

    /**
     * Checks if a key exists
     * @param {string} key - The key to check
     * @returns {Promise<boolean>} True if key exists, false otherwise
     */
    async exists(key: string): Promise<boolean> {
        const result = await this.redisClient.exists(key);
        return result === 1;
    }

    /**
     * Incrementally iterates over keys matching a pattern
     * @param {string} pattern - Pattern to match keys against
     * @param {number} [count=10] - Number of keys to return per iteration
     * @returns {Promise<{cursor: string; keys: string[]}>} Cursor for next iteration and matching keys
     */
    async scan(
        cursor: string,
        pattern: string,
        count: number = 10,
    ): Promise<{ cursor: string; keys: string[] }> {
        const [nextCursor, keys] = await this.redisClient.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            count,
        );
        return { cursor: nextCursor, keys };
    }

    /**
     * Добавляет элементы в начало списка
     */
    async lpush(key: string, ...values: string[]): Promise<number> {
        return this.redisClient.lpush(key, ...values);
    }

    /**
     * Adds one or more members to a set stored at key
     * @param {string} key - The key of the set
     * @param {...string[]} members - One or more members to add to the set
     * @returns {Promise<number>} The number of elements that were added to the set,
     *                           not including elements already present
     */
    async sadd(key: string, ...members: string[]): Promise<number> {
        try {
            return await this.redisClient.sadd(key, ...members);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            console.error(
                `Redis SADD operation failed for key ${key}: ${errorMessage}`,
            );
            throw error;
        }
    }

    /**
     * Returns all members of the set stored at key
     * @param {string} key - The key of the set
     * @returns {Promise<string[]>} Array containing all members of the set,
     *                             or an empty array when key does not exist
     */
    async smembers(key: string): Promise<string[]> {
        try {
            return await this.redisClient.smembers(key);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            console.error(
                `Redis SMEMBERS operation failed for key ${key}: ${errorMessage}`,
            );
            throw error;
        }
    }

    /**
     * Removes one or more members from a set stored at key
     * @param {string} key - The key of the set
     * @param {...string[]} members - One or more members to remove from the set
     * @returns {Promise<number>} The number of members that were removed from the set,
     *                           not including non-existing members
     */
    async srem(key: string, ...members: string[]): Promise<number> {
        try {
            return await this.redisClient.srem(key, ...members);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            console.error(
                `Redis SREM operation failed for key ${key}: ${errorMessage}`,
            );
            throw error;
        }
    }

    /**
     * Удаляет и возвращает последний элемент списка
     */
    async rpop(key: string): Promise<string | null> {
        return this.redisClient.rpop(key);
    }

    /**
     * Возвращает длину списка
     */
    async llen(key: string): Promise<number> {
        return this.redisClient.llen(key);
    }

    /**
     * Атомарно перемещает элемент между списками
     */
    async rpoplpush(
        source: string,
        destination: string,
    ): Promise<string | null> {
        return this.redisClient.rpoplpush(source, destination);
    }

    async lrem(key: string, count: number, value: string): Promise<number> {
        return this.redisClient.lrem(key, count, value);
    }

    async lrange(key: string, start: number, stop: number): Promise<string[]> {
        return this.redisClient.lrange(key, start, stop);
    }

    /**
     * Closes the Redis connection
     * @returns {Promise<void>}
     */
    private async quit(): Promise<void> {
        await this.redisClient.quit();
    }

    async onModuleDestroy() {
        await this.quit();
    }
}
