import { Injectable } from '@nestjs/common';
import {
    HealthCheckError,
    HealthIndicator,
    HealthIndicatorResult,
} from '@nestjs/terminus';
import { VectorizationService } from 'src/infrastructure/vectorization/service/vectorization.service';

@Injectable()
export class VectorizationHealthIndicator extends HealthIndicator {
    constructor(private readonly vectorization: VectorizationService) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        const health = await this.vectorization.healthCheck();
        const details = {
            provider: health.provider,
            store: health.store,
        };

        if (health.healthy) {
            return this.getStatus(key, true, details);
        }

        throw new HealthCheckError(
            'Vectorization health check failed',
            this.getStatus(key, false, details),
        );
    }
}
