export abstract class SecretsConfig {
    redis: {
        host: string;
        port: number;
        password: string;
        db: number;
        ttl: number;
    };

    rateLimit: {
        ttl: number;
        limit: number;
    };

    cors: {
        enabled: boolean;
        origins: string[] | '*';
    };

    max: {
        botToken: string;
        apiBaseUrl: string;
        webhookSecret: string;
        webhookPath: string;
        webhookBaseUrl?: string;
    };

    ai: {
        llm: {
            apiKey: string;
            baseUrl?: string;
        };
        queryCacheTtl: number;
        models: {
            coordinator: string[];
            analytics: string[];
            response: string[];
            summarization: string[];
        };
        http: {
            timeout: number;
            maxRetries: number;
        };
    };

    locales: {
        cmsTimeout: number;
        cacheTtl: number;
    };

    postgres: {
        url: string;
        maxPoolSize: number;
        idleTimeoutMs: number;
        connectionTimeoutMs: number;
        ssl: boolean;
    };

    embedding: {
        // Vectorization
        vectorizationProvider: 'ollama' | 'openai' | 'cohere';
        vectorizationModel: string;
        vectorizationUrl: string;
        vectorizationTimeout: number;
        vectorizationMaxRetries: number;
        vectorizationBatchSize: number;
        vectorizationConcurrency: number;
        vectorizationNormalize: boolean;

        // Database
        databaseProvider: 'weaviate' | 'pinecone' | 'qdrant';
        databaseUrl: string;
        databaseApiKey?: string;
        databaseClassName: string;
        databaseTimeout: number;
        databaseBatchSize: number;

        // Text Processing
        textProcessingMinLength: number;
        textProcessingMaxLength: number;
        textProcessingMinSectionLength: number;
        textProcessingNormalizeWhitespace: boolean;
        textProcessingRemoveUrls: boolean;
        textProcessingRemoveEmails: boolean;
        textProcessingCleanPunctuation: boolean;
        textProcessingRemoveEmojis: boolean;
        textProcessingRemoveControlChars: boolean;
        textProcessingRemoveStopWords: boolean;
        textProcessingAutoDetectSections: boolean;

        // Search
        searchDefaultLimit: number;
        searchDefaultThreshold: number;
        searchMaxLimit: number;
        searchHybridAlpha: number;
    };

    metrics: {
        logRetentionDays: number;
    };

    retention: {
        feedbackDays: number;
        actionLogDays: number;
    };

    security: {
        session: {
            signingKey: string;
            cookieName: string;
            cookieDomain: string | undefined;
            cookieMaxAgeSec: number;
            cookieSameSite: 'none' | 'lax' | 'strict';
            cookieSecure: boolean;
        };
        jwt: {
            signingKey: string;
            ttlSec: number;
            issuer: string;
        };
        ban: {
            defaultTtlSec: number;
        };
        integration: {
            apiKeys: ReadonlyArray<{
                readonly name: string;
                readonly hash: string;
                readonly role: 'admin' | 'read-only';
            }>;
        };
    };
}
