import { z } from 'zod';

export const globalConfigSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'production', 'staging', 'test'])
        .default('development'),

    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().default(3000),
    SWAGGER_ENABLED: z.coerce.boolean().default(false),
    SWAGGER_PATH: z.string().default('api-docs'),

    VERSION: z.string().default('0.1.0'),
    LOG_LEVEL: z
        .enum(['error', 'warn', 'info', 'debug', 'verbose'])
        .default('info'),
});

export type GlobalConfigSchemaType = z.infer<typeof globalConfigSchema>;

export function validateGlobalConfig(
    config: Record<string, unknown>,
): GlobalConfigSchemaType {
    return globalConfigSchema.parse(config);
}
