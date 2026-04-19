import { registerAs } from '@nestjs/config';
import { GlobalConfig } from '../interfaces';

export const globalConfig = registerAs('app', (): GlobalConfig => {
    const rawHost = process.env.HOST || '0.0.0.0';
    const normalizedHost = rawHost === 'localhost' ? '127.0.0.1' : rawHost;

    return {
        env: {
            isProduction: process.env.NODE_ENV === 'production',
            isDevelopment: process.env.NODE_ENV === 'development',
            isStaging: process.env.NODE_ENV === 'staging',
            isLocalhost: ['localhost', '127.0.0.1'].includes(rawHost),
        },

        server: {
            port: parseInt(process.env.PORT || '3000', 10),
            host: normalizedHost,
            version: process.env.VERSION || '0.1.0',
            logLevel: process.env.LOG_LEVEL || 'info',
            swagger: {
                enabled: Boolean(process.env.SWAGGER_ENABLED === 'true'),
                path: process.env.SWAGGER_PATH || 'api-docs',
            },
        },
    };
});
