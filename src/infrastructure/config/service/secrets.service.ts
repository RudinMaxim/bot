import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsConfig } from '../interfaces';

@Injectable()
export class SecretsConfigService {
    private secretsConfigCache: SecretsConfig | null = null;

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: Logger,
    ) {}

    get ai(): SecretsConfig['ai'] {
        const ai = this.configService.get<SecretsConfig['ai']>('secrets.ai');
        if (!ai) {
            this.logger.error('AI configuration is missing');
            throw new Error('AI configuration is missing');
        }
        return ai;
    }

    get redis(): SecretsConfig['redis'] {
        const redis =
            this.configService.get<SecretsConfig['redis']>('secrets.redis');
        if (!redis) {
            this.logger.error('Redis configuration is missing');
            throw new Error('Redis configuration is missing');
        }
        return redis;
    }

    get rateLimit(): SecretsConfig['rateLimit'] {
        const rateLimit =
            this.configService.get<SecretsConfig['rateLimit']>(
                'secrets.rateLimit',
            );
        if (!rateLimit) {
            this.logger.warn('Rate limit configuration is missing');
        }
        return rateLimit!;
    }

    get embedding(): SecretsConfig['embedding'] {
        const embedding =
            this.configService.get<SecretsConfig['embedding']>(
                'secrets.embedding',
            );
        if (!embedding) {
            this.logger.error('Embedding configuration is missing');
            throw new Error('Embedding configuration is missing');
        }
        return embedding;
    }

    get cors(): SecretsConfig['cors'] {
        const cors =
            this.configService.get<SecretsConfig['cors']>('secrets.cors');
        if (!cors) {
            this.logger.warn('CORS configuration is missing');
        }
        return cors!;
    }

    get realEstate(): SecretsConfig['realEstate'] {
        const realEstate =
            this.configService.get<SecretsConfig['realEstate']>(
                'secrets.realEstate',
            );
        if (!realEstate) {
            this.logger.warn('Real Estate configuration is missing');
        }
        return realEstate!;
    }

    get locales(): SecretsConfig['locales'] {
        const locales =
            this.configService.get<SecretsConfig['locales']>('secrets.locales');
        if (!locales) {
            this.logger.warn('Locales configuration is missing');
        }
        return locales!;
    }

    get postgres(): SecretsConfig['postgres'] {
        const postgres =
            this.configService.get<SecretsConfig['postgres']>(
                'secrets.postgres',
            );
        if (!postgres) {
            this.logger.error('Postgres configuration is missing');
            throw new Error('Postgres configuration is missing');
        }
        return postgres;
    }

    get metrics(): SecretsConfig['metrics'] {
        const metrics =
            this.configService.get<SecretsConfig['metrics']>('secrets.metrics');
        if (!metrics) {
            this.logger.warn('Metrics configuration is missing');
        }
        return metrics!;
    }

    get retention(): SecretsConfig['retention'] {
        const retention =
            this.configService.get<SecretsConfig['retention']>(
                'secrets.retention',
            );
        if (!retention) {
            this.logger.warn('Retention configuration is missing');
        }
        return retention!;
    }

    get security(): SecretsConfig['security'] {
        const security =
            this.configService.get<SecretsConfig['security']>(
                'secrets.security',
            );
        if (!security) {
            this.logger.error('Security configuration is missing');
            throw new Error('Security configuration is missing');
        }
        return security;
    }

    getSecretsConfig(): SecretsConfig {
        if (!this.secretsConfigCache) {
            const config = this.configService.get<SecretsConfig>('secrets');
            if (!config) {
                this.logger.error('Secrets configuration is missing');
                throw new Error('Secrets configuration is missing');
            }
            this.secretsConfigCache = config;
        }
        return this.secretsConfigCache;
    }
}
