export abstract class GlobalConfig {
    env: {
        isProduction: boolean;
        isDevelopment: boolean;
        isLocalhost: boolean;
        isStaging: boolean;
    };

    server: {
        port: number;
        host: string;
        version: string;
        logLevel: string;
        swagger: {
            enabled: boolean;
            path: string;
        };
    };
}
