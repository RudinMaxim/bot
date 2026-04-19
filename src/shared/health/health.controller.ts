import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PostgresHealthIndicator } from './postgres.health';
import { Public } from 'src/shared/security/decorators/public.decorator';
import { RedisHealthIndicator } from './redis.health';
import { VectorizationHealthIndicator } from './vectorization.health';

@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly postgres: PostgresHealthIndicator,
        private readonly redis: RedisHealthIndicator,
        private readonly vectorization: VectorizationHealthIndicator,
    ) {}

    @Get('live')
    @Public()
    @HealthCheck()
    live() {
        return this.health.check([
            () => ({
                app: { status: 'up' },
            }),
        ]);
    }

    @Get('ready')
    @Public()
    @HealthCheck()
    ready() {
        return this.health.check([
            () => this.postgres.isHealthy('postgres'),
            () => this.redis.isHealthy('redis'),
            () => this.vectorization.isHealthy('vectorization'),
        ]);
    }
}
