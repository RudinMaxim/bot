import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, SecretsConfig } from '../../config';
import { TYPEORM_ENTITIES } from './entities';

@Global()
@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (secrets: SecretsConfig) => ({
                type: 'postgres',
                url: secrets.postgres.url,
                ssl: secrets.postgres.ssl
                    ? { rejectUnauthorized: false }
                    : undefined,
                synchronize: false,
                autoLoadEntities: false,
                entities: [...TYPEORM_ENTITIES],
                migrations: [__dirname + '/migrations/*{.ts,.js}'],
            }),
            inject: [SecretsConfig],
        }),
    ],
    exports: [TypeOrmModule],
})
export class TypeormPersistenceModule {}
