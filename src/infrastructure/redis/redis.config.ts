import Redis, { Callback } from 'ioredis';

export const REDIS_CONFIG = 'REDIS_CONFIG';
export const REDIS_CLIENT = 'REDIS_CLIENT';

export abstract class RedisService {
    abstract getClient(): Redis;
    abstract get<T = any>(key: string): Promise<T | null>;
    abstract set(key: string, value: string, ttl?: number): Promise<void>;
    abstract del(key: string): Promise<number>;
    abstract keys(pattern: string): Promise<string[]>;
    abstract mget(keys: string[]): Promise<(string | null)[]>;
    abstract mset(keyValuePairs: Record<string, string>): Promise<void>;
    abstract incr(key: string): Promise<number>;
    abstract decr(key: string): Promise<number>;
    abstract expire(key: string, seconds: number): Promise<boolean>;
    abstract ttl(key: string): Promise<number>;
    abstract exists(key: string): Promise<boolean>;
    abstract scan(
        cursor: string,
        pattern: string,
        count: number,
    ): Promise<{ cursor: string; keys: string[] }>;
    abstract lpush(key: string, ...values: string[]): Promise<number>;
    abstract rpop(key: string): Promise<string | null>;
    abstract llen(key: string): Promise<number>;
    abstract rpoplpush(
        source: string,
        destination: string,
    ): Promise<string | null>;
    abstract lrem(key: string, count: number, value: string): Promise<number>;
    abstract lrange(
        key: string,
        start: number,
        stop: number,
    ): Promise<string[]>;
    abstract sadd(key: string, ...members: string[]): Promise<number>;
    abstract smembers(key: string): Promise<string[]>;
    abstract srem(key: string, ...members: string[]): Promise<number>;
    abstract setnx(
        key: string,
        value: string | Buffer | number,
        callback?: Callback<number>,
    ): Promise<number>;
    abstract setIfNotExists(
        key: string,
        value: string,
        ttlSeconds: number,
    ): Promise<boolean>;
}
