import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/infrastructure/redis';

@Injectable()
export class RateLimitRepository {
    private static readonly PREFIX = 'messaging:ratelimit:';

    constructor(private readonly redis: RedisService) {}

    async consume(
        category: 'connection' | 'message',
        key: string,
        limit: number,
        ttlSeconds: number,
    ): Promise<boolean> {
        const normalizedKey = key.trim();
        if (!normalizedKey) {
            return false;
        }

        const redisKey = `${RateLimitRepository.PREFIX}${category}:${normalizedKey}`;
        const count = await this.redis.incr(redisKey);
        if (count === 1) {
            await this.redis.expire(redisKey, ttlSeconds);
        }

        return count <= limit;
    }
}
