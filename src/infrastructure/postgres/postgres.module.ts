import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigModule, SecretsConfig } from '../config';
import {
    POSTGRES_CONFIG,
    POSTGRES_POOL,
    PostgresConfig,
} from './postgres.config';
import { PostgresService } from './postgres.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        PostgresService,
        {
            provide: POSTGRES_CONFIG,
            useFactory: (secrets: SecretsConfig): PostgresConfig => ({
                url: secrets.postgres.url,
                maxPoolSize: secrets.postgres.maxPoolSize,
                idleTimeoutMs: secrets.postgres.idleTimeoutMs,
                connectionTimeoutMs: secrets.postgres.connectionTimeoutMs,
                ssl: secrets.postgres.ssl,
            }),
            inject: [SecretsConfig],
        },
        {
            provide: POSTGRES_POOL,
            useFactory: (config: PostgresConfig): Pool => {
                return new Pool({
                    connectionString: config.url,
                    max: config.maxPoolSize,
                    idleTimeoutMillis: config.idleTimeoutMs,
                    connectionTimeoutMillis: config.connectionTimeoutMs,
                    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
                });
            },
            inject: [POSTGRES_CONFIG],
        },
    ],
    exports: [PostgresService, POSTGRES_POOL],
})
export class PostgresModule {}
