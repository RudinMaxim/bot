import { APP_GUARD } from '@nestjs/core';
import {
    Module,
    DynamicModule,
    INestApplication,
    Logger,
} from '@nestjs/common';
import helmet from 'helmet';
import {
    ThrottlerGuard,
    ThrottlerModule,
    ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { SecretsConfig, ConfigModule } from '../../infrastructure/config';
import { RedisModule, RedisService } from '../../infrastructure/redis';
import { resolveCorsOptions } from './cors/resolve-cors-options';
import { CookieSigner } from './crypto/cookie-signer';
import { JwtSigner } from './crypto/jwt-signer';
import { IdentityService } from './services/identity.service';
import {
    BanListService,
    BanListServiceConfig,
} from './services/ban-list.service';
import { BanGuard } from './guards/ban.guard';
import { IdentityGuard } from './guards/identity.guard';
import { ChatOwnershipService } from './services/chat-ownership.service';
import { OwnershipGuard } from './guards/ownership.guard';
import { ApiKeyRegistryService } from './services/api-key-registry.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { SessionBootstrapController } from './controllers/session-bootstrap.controller';

@Module({})
export class SecurityModule {
    static forRoot(): DynamicModule {
        return {
            module: SecurityModule,
            // Global so feature modules (messaging, integration, …) can
            // consume IdentityService / OwnershipGuard / decorators
            // without re-importing forRoot() and accidentally creating
            // a second copy of the security providers.
            global: true,
            imports: [
                ConfigModule,
                RedisModule,
                ThrottlerModule.forRootAsync({
                    imports: [ConfigModule],
                    inject: [SecretsConfig],
                    useFactory: (
                        config: SecretsConfig,
                    ): ThrottlerModuleOptions => ({
                        throttlers: [
                            {
                                ttl: config.rateLimit.ttl,
                                limit: config.rateLimit.limit,
                            },
                        ],
                    }),
                }),
            ],
            controllers: [SessionBootstrapController],
            providers: [
                Logger,
                {
                    provide: APP_GUARD,
                    useClass: ThrottlerGuard,
                },
                {
                    provide: CookieSigner,
                    inject: [SecretsConfig],
                    useFactory: (secrets: SecretsConfig) =>
                        new CookieSigner(secrets.security.session.signingKey),
                },
                {
                    provide: JwtSigner,
                    inject: [SecretsConfig],
                    useFactory: (secrets: SecretsConfig) =>
                        new JwtSigner({
                            key: secrets.security.jwt.signingKey,
                            ttlSec: secrets.security.jwt.ttlSec,
                            issuer: secrets.security.jwt.issuer,
                        }),
                },
                {
                    provide: IdentityService,
                    inject: [SecretsConfig, CookieSigner, JwtSigner],
                    useFactory: (
                        secrets: SecretsConfig,
                        cookieSigner: CookieSigner,
                        jwtSigner: JwtSigner,
                    ) =>
                        new IdentityService(
                            secrets.security,
                            cookieSigner,
                            jwtSigner,
                        ),
                },
                {
                    provide: BanListService,
                    inject: [RedisService, SecretsConfig],
                    useFactory: (
                        redis: RedisService,
                        secrets: SecretsConfig,
                    ) => {
                        const cfg: BanListServiceConfig = {
                            defaultTtlSec: secrets.security.ban.defaultTtlSec,
                        };
                        return new BanListService(redis, cfg);
                    },
                },
                BanGuard,
                IdentityGuard,
                {
                    provide: ChatOwnershipService,
                    inject: [RedisService],
                    useFactory: (redis: RedisService) =>
                        new ChatOwnershipService(redis),
                },
                OwnershipGuard,
                {
                    provide: ApiKeyRegistryService,
                    inject: [SecretsConfig],
                    useFactory: (secrets: SecretsConfig) =>
                        new ApiKeyRegistryService(
                            secrets.security.integration.apiKeys,
                        ),
                },
                ApiKeyGuard,
            ],
            exports: [
                ThrottlerModule,
                CookieSigner,
                JwtSigner,
                IdentityService,
                BanListService,
                BanGuard,
                IdentityGuard,
                ChatOwnershipService,
                OwnershipGuard,
                ApiKeyRegistryService,
                ApiKeyGuard,
            ],
        };
    }

    static configure(
        app: INestApplication,
        secretsService: SecretsConfig,
    ): void {
        app.enableCors(resolveCorsOptions(secretsService.cors));

        app.use(
            helmet({
                contentSecurityPolicy: {
                    useDefaults: true,
                    directives: {
                        'script-src': [
                            "'self'",
                            "'unsafe-inline'",
                            "'wasm-unsafe-eval'",
                            "'inline-speculation-rules'",
                        ],
                    },
                },
                crossOriginResourcePolicy: { policy: 'cross-origin' },
            }),
        );
    }
}
