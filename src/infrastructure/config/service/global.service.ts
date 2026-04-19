import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GlobalConfig } from '../interfaces';

@Injectable()
export class GlobalConfigService {
    private globalConfigCache: GlobalConfig | null = null;

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: Logger,
    ) {}

    get env(): GlobalConfig['env'] {
        const env = this.configService.get<GlobalConfig['env']>('app.env');
        if (!env) {
            this.logger.warn('Environment configuration is missing');
        }
        return env!;
    }

    get server(): GlobalConfig['server'] {
        const server =
            this.configService.get<GlobalConfig['server']>('app.server');
        if (!server) {
            this.logger.error('Server configuration is missing');
            throw new Error('Server configuration is missing');
        }

        return server;
    }

    getAppConfig(): GlobalConfig {
        if (!this.globalConfigCache) {
            const config = this.configService.get<GlobalConfig>('app');
            if (!config) {
                this.logger.error('Application configuration is missing');
                throw new Error('Application configuration is missing');
            }
            this.globalConfigCache = config;
        }
        return this.globalConfigCache;
    }
}
