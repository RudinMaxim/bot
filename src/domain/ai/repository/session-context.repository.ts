import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/infrastructure/redis';

@Injectable()
export class SessionContextRepository {
    private readonly sessionPrefix = 'session';
    private readonly archivePrefix = 'archive';
    private readonly lockPrefix = 'lock:summarization';

    constructor(private readonly redis: RedisService) {}

    async get(sessionId: string, version: number): Promise<string | null> {
        return this.redis.get(this.buildSessionKey(sessionId, version));
    }

    async set(
        sessionId: string,
        version: number,
        value: string,
        ttlSeconds: number,
    ): Promise<void> {
        await this.redis.set(
            this.buildSessionKey(sessionId, version),
            value,
            ttlSeconds,
        );
    }

    async delete(sessionId: string, version: number): Promise<void> {
        await this.redis.del(this.buildSessionKey(sessionId, version));
    }

    async exists(sessionId: string, version: number): Promise<boolean> {
        return this.redis.exists(this.buildSessionKey(sessionId, version));
    }

    async saveArchive(
        sessionId: string,
        value: string,
        ttlSeconds: number,
    ): Promise<void> {
        const key = `${this.archivePrefix}:${sessionId}:${Date.now()}`;
        await this.redis.set(key, value, ttlSeconds);
    }

    async acquireSummarizationLock(
        sessionId: string,
        ttlSeconds: number,
    ): Promise<boolean> {
        return this.redis.setIfNotExists(
            this.buildLockKey(sessionId),
            'locked',
            ttlSeconds,
        );
    }

    async releaseSummarizationLock(sessionId: string): Promise<void> {
        await this.redis.del(this.buildLockKey(sessionId));
    }

    async hasSummarizationLock(sessionId: string): Promise<boolean> {
        return this.redis.exists(this.buildLockKey(sessionId));
    }

    private buildSessionKey(sessionId: string, version: number): string {
        return `${this.sessionPrefix}:v${version}:${sessionId}`;
    }

    private buildLockKey(sessionId: string): string {
        return `${this.lockPrefix}:${sessionId}`;
    }
}
