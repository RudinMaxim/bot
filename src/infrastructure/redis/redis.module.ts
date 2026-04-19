import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisServiceImpl } from './redis.service';
import { SecretsConfig, ConfigModule } from '../config';
import { RedisService, REDIS_CONFIG, REDIS_CLIENT } from './redis.config';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: RedisService,
            useClass: RedisServiceImpl,
        },
        {
            provide: REDIS_CONFIG,
            useFactory: (
                SecretsService: SecretsConfig,
            ): SecretsConfig['redis'] => ({
                host: SecretsService.redis.host,
                port: SecretsService.redis.port,
                password: SecretsService.redis.password,
                db: SecretsService.redis.db,
                ttl: SecretsService.redis.ttl,
            }),
            inject: [SecretsConfig],
        },
        {
            provide: REDIS_CLIENT,
            useFactory: (config: SecretsConfig['redis']): Redis => {
                const client = new Redis({
                    host: config.host,
                    port: config.port,
                    password: config.password,
                    db: config.db,
                    maxRetriesPerRequest: null,
                    commandTimeout: 30000,
                    connectTimeout: 60000,
                    lazyConnect: true,
                    keepAlive: 30000,
                    enableOfflineQueue: true,
                });
                return client;
            },
            inject: [REDIS_CONFIG],
        },
    ],
    exports: [RedisService],
})
export class RedisModule {}
