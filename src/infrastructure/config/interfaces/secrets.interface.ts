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
        speechkit: {
            apiKey?: string;
            iamToken?: string;
            folderId?: string;
            ttsEndpoint: string;
            timeoutMs: number;
            maxRetries: number;
        };
        models: {
            coordinator: string[];
            analytics: string[];
            response: string[];
            siteAssistant: string[];
            summarization: string[];
            speechRecognition: string[];
        };
        http: {
            timeout: number;
            maxRetries: number;
        };
        siteAssistant: {
            actionsCacheTtl: number;
            actionsCacheType: 'redis' | 'memory';
            reindexOnStartup: boolean;
            crawler: {
                baseUrls: string[];
                sitemapPath: string;
                userAgent: string;
                maxPages: number;
                maxDepth: number;
                rateLimitMs: number;
                requestTimeoutMs: number;
                renderMode: 'http' | 'hybrid';
                browser: {
                    enabled: boolean;
                    timeoutMs: number;
                    waitUntil: 'domcontentloaded' | 'load' | 'networkidle';
                    postLoadDelayMs: number;
                };
            };
            elementIndex: {
                topK: number;
                minSimilarity: number;
                className: string;
                lookupTimeoutMs: number;
                hybridAlpha: number;
            };
        };
    };

    realEstate: {
        apiUsername: string;
        apiPassword: string;
        apiBaseUrl: string;
        origin: string;
        apiTimeout: number;
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
        audioTempCleanupHours: number;
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
