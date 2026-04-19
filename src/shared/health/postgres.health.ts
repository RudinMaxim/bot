import { Injectable } from '@nestjs/common';
import {
    HealthCheckError,
    HealthIndicator,
    HealthIndicatorResult,
} from '@nestjs/terminus';
import { PostgresService } from 'src/infrastructure/postgres';

@Injectable()
export class PostgresHealthIndicator extends HealthIndicator {
    constructor(private readonly postgres: PostgresService) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        const ok = await this.postgres.ping();
        if (ok) {
            return this.getStatus(key, true);
        }
        throw new HealthCheckError(
            'Postgres health check failed',
            this.getStatus(key, false),
        );
    }
}
