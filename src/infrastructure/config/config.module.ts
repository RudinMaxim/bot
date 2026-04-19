import { Logger, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { globalConfig, secretsConfig } from './register';
import { GlobalConfigService, SecretsConfigService } from './service';
import { GlobalConfig, SecretsConfig } from './interfaces';
import { z } from 'zod';
import { getEnvFilePaths } from './env-paths';
import {
    GlobalConfigSchemaType,
    SecretsSchemaType,
    validateGlobalConfig,
    validateSecretsConfig,
} from './schemas';

interface Config {
    global: GlobalConfigSchemaType;
    secrets: SecretsSchemaType;
}

function validate(config: Record<keyof Config, unknown>): Config | never {
    try {
        return {
            global: validateGlobalConfig(config),
            secrets: validateSecretsConfig(config),
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`Validation error: ${error.message}`);
        }
        throw error;
    }
}

@Module({
    imports: [
        NestConfigModule.forRoot({
            envFilePath: getEnvFilePaths(),
            expandVariables: true,
            load: [globalConfig, secretsConfig],
            validate,
            isGlobal: true,
        }),
    ],
    providers: [
        GlobalConfigService,
        SecretsConfigService,
        {
            provide: GlobalConfig,
            useClass: GlobalConfigService,
        },
        {
            provide: SecretsConfig,
            useClass: SecretsConfigService,
        },
        Logger,
    ],
    exports: [
        GlobalConfig,
        SecretsConfig,
        GlobalConfigService,
        SecretsConfigService,
    ],
})
export class ConfigModule {}
