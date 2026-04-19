import { Injectable, Logger } from '@nestjs/common';
import { ResponseAgentOutput } from '../agents';
import { ProcessResult } from '../common/types';
import { SecretsConfig } from 'src/infrastructure/config';
import { RedisService } from 'src/infrastructure/redis';

type QueryCacheEntry = {
    result: ProcessResult<ResponseAgentOutput>;
    createdAt: string;
};

@Injectable()
export class QueryCacheRepository {
    private readonly logger = new Logger(QueryCacheRepository.name);
    private readonly cachePrefix = 'ai:query-cache';
    private readonly cacheVersion = 'v1';
    private readonly cacheTtlSeconds: number;

    constructor(
        private readonly redisService: RedisService,
        private readonly secretsConfig: SecretsConfig,
    ) {
        this.cacheTtlSeconds = this.resolveCacheTtl();
    }

    async get(
        cacheKey: string,
    ): Promise<ProcessResult<ResponseAgentOutput> | null> {
        try {
            const raw = await this.redisService.get<string>(
                this.buildCacheKey(cacheKey),
            );
            if (!raw) return null;

            const parsed = JSON.parse(raw) as QueryCacheEntry;
            if (!this.isCacheEntry(parsed)) {
                await this.redisService.del(this.buildCacheKey(cacheKey));
                return null;
            }

            return parsed.result;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(
                `Failed to read query cache for ${cacheKey}: ${message}`,
            );
            return null;
        }
    }

    async set(
        cacheKey: string,
        result: ProcessResult<ResponseAgentOutput>,
    ): Promise<void> {
        if (!result.success || !result.data || this.cacheTtlSeconds <= 0) {
            return;
        }

        try {
            const payload: QueryCacheEntry = {
                result,
                createdAt: new Date().toISOString(),
            };

            await this.redisService.set(
                this.buildCacheKey(cacheKey),
                JSON.stringify(payload),
                this.cacheTtlSeconds,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(
                `Failed to write query cache for ${cacheKey}: ${message}`,
            );
        }
    }

    private buildCacheKey(cacheKey: string): string {
        return `${this.cachePrefix}:${this.cacheVersion}:${cacheKey}`;
    }

    private resolveCacheTtl(): number {
        const raw =
            this.secretsConfig.ai?.queryCacheTtl ??
            this.secretsConfig.redis?.ttl ??
            300;
        const value =
            typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
        if (!Number.isFinite(value)) {
            return 300;
        }

        return Math.max(1, Math.floor(value));
    }

    private isCacheEntry(value: unknown): value is QueryCacheEntry {
        if (!value || typeof value !== 'object') {
            return false;
        }

        const entry = value as QueryCacheEntry;
        return (
            typeof entry.createdAt === 'string' &&
            this.isCachedResult(entry.result)
        );
    }

    private isCachedResult(
        value: unknown,
    ): value is ProcessResult<ResponseAgentOutput> {
        if (!value || typeof value !== 'object') {
            return false;
        }

        const result = value as ProcessResult<ResponseAgentOutput>;
        return (
            result.success === true &&
            typeof result.sessionId === 'string' &&
            typeof result.timestamp === 'string' &&
            !!result.data &&
            typeof result.data.response === 'string'
        );
    }
}
