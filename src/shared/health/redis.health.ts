import { Injectable } from '@nestjs/common';
import {
    HealthCheckError,
    HealthIndicator,
    HealthIndicatorResult,
} from '@nestjs/terminus';
import { RedisService } from 'src/infrastructure/redis/redis.config';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
    constructor(private readonly redisService: RedisService) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        try {
            const result = await this.redisService.getClient().ping();
            const isHealthy = result === 'PONG';
            if (isHealthy) {
                return this.getStatus(key, true);
            }
            throw new Error('Redis ping failed');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            throw new HealthCheckError(
                'Redis health check failed',
                this.getStatus(key, false, { message }),
            );
        }
    }
}
