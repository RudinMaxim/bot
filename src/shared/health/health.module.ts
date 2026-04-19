import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { VectorizationModule } from 'src/infrastructure/vectorization';
import { HealthController } from './health.controller';
import { PostgresHealthIndicator } from './postgres.health';
import { RedisHealthIndicator } from './redis.health';
import { VectorizationHealthIndicator } from './vectorization.health';

@Module({
    imports: [TerminusModule, VectorizationModule],
    controllers: [HealthController],
    providers: [
        PostgresHealthIndicator,
        RedisHealthIndicator,
        VectorizationHealthIndicator,
    ],
})
export class HealthModule {}
