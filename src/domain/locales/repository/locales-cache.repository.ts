import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/infrastructure/redis';
import { LocaleCacheEntry } from '../common/types';

@Injectable()
export class LocalesCacheRepository {
    private readonly logger = new Logger(LocalesCacheRepository.name);
    private readonly cachePrefix = 'locales';
    private readonly refreshLockPrefix = 'locales:lock';

    constructor(private readonly redisService: RedisService) {}

    async get(locale: string): Promise<LocaleCacheEntry | null> {
        const key = this.buildCacheKey(locale);
        const raw = await this.redisService.get<string>(key);
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw) as LocaleCacheEntry;
            if (!this.isCacheEntry(parsed)) {
                await this.redisService.del(key);
                return null;
            }
            return parsed;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Invalid locale cache for ${locale}: ${message}`);
            await this.redisService.del(key);
            return null;
        }
    }

    async set(
        locale: string,
        entry: LocaleCacheEntry,
        ttl?: number,
    ): Promise<void> {
        const key = this.buildCacheKey(locale);
        const payload = JSON.stringify(entry);
        await this.redisService.set(key, payload, ttl);
    }

    async delete(locale: string): Promise<void> {
        const key = this.buildCacheKey(locale);
        await this.redisService.del(key);
    }

    async acquireRefreshLock(
        locale: string,
        ttlSeconds: number,
    ): Promise<boolean> {
        const key = this.buildRefreshLockKey(locale);
        const acquired = await this.redisService.setnx(key, Date.now());
        if (acquired) {
            await this.redisService.expire(key, ttlSeconds);
            return true;
        }
        return false;
    }

    async releaseRefreshLock(locale: string): Promise<void> {
        const key = this.buildRefreshLockKey(locale);
        await this.redisService.del(key);
    }

    private buildCacheKey(locale: string): string {
        return `${this.cachePrefix}:${locale}`;
    }

    private buildRefreshLockKey(locale: string): string {
        return `${this.refreshLockPrefix}:${locale}`;
    }

    private isCacheEntry(value: unknown): value is LocaleCacheEntry {
        if (!value || typeof value !== 'object') return false;
        const entry = value as LocaleCacheEntry;
        return (
            typeof entry.locale === 'string' &&
            typeof entry.version === 'string' &&
            typeof entry.lastModified === 'string' &&
            typeof entry.data === 'object' &&
            entry.data !== null &&
            !Array.isArray(entry.data)
        );
    }
}
