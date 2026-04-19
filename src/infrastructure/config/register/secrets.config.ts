import { registerAs } from '@nestjs/config';
import { SecretsConfig } from '../interfaces';
import { parseSecurityConfig } from '../../../shared/security/config/parse-security-config';

const requireEnv = (name: string): string => {
    const value = process.env[name];
    if (!value || !value.trim()) {
        throw new Error(`${name} is required`);
    }
    return value.trim();
};

const parseModelList = (
    availableRaw: string | undefined,
    fallback: string[],
): string[] => {
    const source = availableRaw?.trim() || fallback.join(',');
    const models = source
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    return models.length ? models : [...fallback];
};

export const secretsConfig = registerAs('secrets', (): SecretsConfig => {
    const security = parseSecurityConfig(process.env);
    for (const w of security.warnings) {
        // Logger is not yet available at config-load time; use console.warn
        // so the message appears in the startup log stream.
        console.warn(`[security-config] ${w.field}: ${w.message}`);
    }

    return {
        locales: {
            cmsTimeout: parseInt(
                process.env.CMS_LOCALES_TIMEOUT || '10000',
                10,
            ),
            cacheTtl: parseInt(
                process.env.CMS_LOCALES_CACHE_TTL ||
                    process.env.REDIS_TTL ||
                    '3600',
                10,
            ),
        },

        postgres: {
            url: requireEnv('POSTGRES_URL'),
            maxPoolSize: parseInt(
                process.env.POSTGRES_MAX_POOL_SIZE || '10',
                10,
            ),
            idleTimeoutMs: parseInt(
                process.env.POSTGRES_IDLE_TIMEOUT_MS || '30000',
                10,
            ),
            connectionTimeoutMs: parseInt(
                process.env.POSTGRES_CONNECTION_TIMEOUT_MS || '5000',
                10,
            ),
            ssl: process.env.POSTGRES_SSL === 'true',
        },

        redis: {
            host: requireEnv('REDIS_HOST'),
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || '',
            db: parseInt(process.env.REDIS_DB || '0', 10),
            ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
        },

        rateLimit: {
            ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
            limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        },

        cors: {
            enabled: process.env.CORS_ENABLED !== 'false',
            origins: (process.env.CORS_ORIGINS || '*')
                .split(',')
                .map((origin) => origin.trim())
                .filter((origin) => origin.length > 0)
                .map((origin) => origin.replace(/\/$/, '')),
        },

        max: {
            botToken: requireEnv('MAX_BOT_TOKEN'),
            apiBaseUrl:
                process.env.MAX_BOT_API_BASE_URL?.trim() ||
                'https://platform-api.max.ru',
            webhookSecret: requireEnv('MAX_WEBHOOK_SECRET'),
            webhookPath:
                process.env.MAX_WEBHOOK_PATH?.trim() ||
                '/api/v1/max/webhook',
            webhookBaseUrl: process.env.MAX_WEBHOOK_BASE_URL?.trim() || undefined,
        },

        ai: {
            llm: {
                apiKey: requireEnv('OPENROUTER_API_KEY'),
                baseUrl:
                    process.env.OPENROUTER_BASE_URL?.trim() ||
                    'https://openrouter.ai/api/v1',
            },
            queryCacheTtl: parseInt(
                process.env.AI_QUERY_CACHE_TTL ||
                    process.env.REDIS_TTL ||
                    '300',
                10,
            ),
            speechkit: {
                apiKey: process.env.YC_API_KEY?.trim() || undefined,
                iamToken:
                    process.env.YC_IAM_TOKEN?.trim() ||
                    process.env.IAM_TOKEN?.trim() ||
                    undefined,
                folderId:
                    process.env.YC_FOLDER_ID?.trim() ||
                    process.env.FOLDER_ID?.trim() ||
                    undefined,
                ttsEndpoint:
                    process.env.YC_TTS_ENDPOINT ||
                    'https://tts.api.cloud.yandex.net:443/tts/v3/utteranceSynthesis',
                timeoutMs: parseInt(
                    process.env.YC_TTS_TIMEOUT_MS || '30000',
                    10,
                ),
                maxRetries: parseInt(process.env.YC_TTS_MAX_RETRIES || '3', 10),
            },
            models: {
                coordinator: parseModelList(
                    process.env.COORDINATOR_AVAILABLE_MODELS,
                    ['gpt-5.4-mini'],
                ),
                analytics: parseModelList(
                    process.env.ANALYTICS_AVAILABLE_MODELS,
                    ['gpt-5.4-nano'],
                ),
                response: parseModelList(
                    process.env.RESPONSE_AVAILABLE_MODELS,
                    ['gpt-5.4-nano', 'gpt-5.4-mini', 'gpt-5.4'],
                ),
                siteAssistant: parseModelList(
                    process.env.SITE_ASSISTANT_AVAILABLE_MODELS,
                    ['gpt-5.4-nano', 'gpt-5.4-mini', 'gpt-5.4'],
                ),
                summarization: parseModelList(
                    process.env.SUMMARIZATION_AVAILABLE_MODELS,
                    ['gpt-5.4-nano'],
                ),
                speechRecognition: parseModelList(
                    process.env.SPEECH_RECOGNITION_AVAILABLE_MODELS,
                    ['gpt-audio-mini'],
                ),
            },
            http: {
                timeout: parseInt(process.env.HTTP_TIMEOUT || '30000', 10),
                maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
            },
            siteAssistant: {
                actionsCacheTtl: parseInt(
                    process.env.CACHE_TTL_ACTIONS_SECONDS || '300',
                    10,
                ),
                actionsCacheType:
                    process.env.CACHE_TYPE === 'memory' ? 'memory' : 'redis',
                reindexOnStartup:
                    process.env.SITE_ASSISTANT_REINDEX_ON_STARTUP === 'true',
                crawler: {
                    baseUrls: (
                        process.env.SITE_ASSISTANT_CRAWLER_BASE_URLS || ''
                    )
                        .split(',')
                        .map((item) => item.trim())
                        .filter((item) => item.length > 0)
                        .map((item) => item.replace(/\/$/, '')),
                    sitemapPath:
                        process.env.SITE_ASSISTANT_CRAWLER_SITEMAP_PATH ||
                        '/sitemap.xml',
                    userAgent:
                        process.env.SITE_ASSISTANT_CRAWLER_USER_AGENT ||
                        'SiteAssistantCrawler/1.0',
                    maxPages: parseInt(
                        process.env.SITE_ASSISTANT_CRAWLER_MAX_PAGES || '500',
                        10,
                    ),
                    maxDepth: parseInt(
                        process.env.SITE_ASSISTANT_CRAWLER_MAX_DEPTH || '3',
                        10,
                    ),
                    rateLimitMs: parseInt(
                        process.env.SITE_ASSISTANT_CRAWLER_RATE_LIMIT_MS ||
                            '200',
                        10,
                    ),
                    requestTimeoutMs: parseInt(
                        process.env.SITE_ASSISTANT_CRAWLER_TIMEOUT_MS ||
                            '10000',
                        10,
                    ),
                    renderMode:
                        process.env.SITE_ASSISTANT_CRAWLER_RENDER_MODE ===
                        'http'
                            ? 'http'
                            : 'hybrid',
                    browser: {
                        enabled:
                            process.env
                                .SITE_ASSISTANT_CRAWLER_BROWSER_ENABLED ===
                            'true',
                        timeoutMs: parseInt(
                            process.env
                                .SITE_ASSISTANT_CRAWLER_BROWSER_TIMEOUT_MS ||
                                '15000',
                            10,
                        ),
                        waitUntil:
                            process.env
                                .SITE_ASSISTANT_CRAWLER_BROWSER_WAIT_UNTIL ===
                                'load' ||
                            process.env
                                .SITE_ASSISTANT_CRAWLER_BROWSER_WAIT_UNTIL ===
                                'networkidle'
                                ? process.env
                                      .SITE_ASSISTANT_CRAWLER_BROWSER_WAIT_UNTIL
                                : 'domcontentloaded',
                        postLoadDelayMs: parseInt(
                            process.env
                                .SITE_ASSISTANT_CRAWLER_BROWSER_POST_LOAD_DELAY_MS ||
                                '1000',
                            10,
                        ),
                    },
                },
                elementIndex: {
                    topK: parseInt(
                        process.env.SITE_ASSISTANT_ELEMENT_INDEX_TOP_K || '30',
                        10,
                    ),
                    minSimilarity: parseFloat(
                        process.env
                            .SITE_ASSISTANT_ELEMENT_INDEX_MIN_SIMILARITY || '0',
                    ),
                    className:
                        process.env.SITE_ASSISTANT_ELEMENT_INDEX_CLASS_NAME ||
                        'SiteElementsIndex',
                    lookupTimeoutMs: parseInt(
                        process.env.SITE_ASSISTANT_ELEMENT_INDEX_TIMEOUT_MS ||
                            '10000',
                        10,
                    ),
                    hybridAlpha: parseFloat(
                        process.env.SITE_ASSISTANT_ELEMENT_INDEX_HYBRID_ALPHA ||
                            '0.35',
                    ),
                },
            },
        },

        realEstate: (() => {
            const apiUsername = process.env.REAL_ESTATE_API_USERNAME || '';
            const apiPassword = process.env.REAL_ESTATE_API_PASSWORD || '';
            const envOrigin = process.env.REAL_ESTATE_ORIGIN || '';
            const envApiBaseUrl = process.env.REAL_ESTATE_API_BASE_URL || '';
            let resolvedApiBaseUrl = envApiBaseUrl.trim();
            let resolvedOrigin = envOrigin.trim();

            if (!resolvedOrigin && resolvedApiBaseUrl) {
                try {
                    resolvedOrigin = new URL(resolvedApiBaseUrl).origin;
                } catch {
                    resolvedOrigin = '';
                }
            }

            if (!resolvedApiBaseUrl && resolvedOrigin) {
                resolvedApiBaseUrl = new URL(
                    '/api/list/',
                    resolvedOrigin,
                ).toString();
            }

            if ((apiUsername || apiPassword) && !resolvedApiBaseUrl) {
                throw new Error(
                    'REAL_ESTATE_API_BASE_URL is required when credentials are set',
                );
            }

            return {
                apiUsername,
                apiPassword,
                apiBaseUrl: resolvedApiBaseUrl,
                origin: resolvedOrigin,
                apiTimeout: parseInt(
                    process.env.REAL_ESTATE_API_TIMEOUT || '10000',
                    10,
                ),
            };
        })(),

        embedding: {
            vectorizationProvider:
                (process.env.EMBEDDING_VECTORIZATION_PROVIDER as
                    | 'ollama'
                    | 'openai'
                    | 'cohere') || 'ollama',
            vectorizationModel:
                process.env.EMBEDDING_VECTORIZATION_MODEL || 'nomic-embed-text-v2-moe',
            vectorizationUrl:
                process.env.EMBEDDING_VECTORIZATION_URL ||
                'http://ollama:11434',
            vectorizationTimeout: parseInt(
                process.env.EMBEDDING_VECTORIZATION_TIMEOUT || '120000',
                10,
            ),
            vectorizationMaxRetries: parseInt(
                process.env.EMBEDDING_VECTORIZATION_MAX_RETRIES || '3',
                10,
            ),
            vectorizationBatchSize: parseInt(
                process.env.EMBEDDING_VECTORIZATION_BATCH_SIZE || '8',
                10,
            ),
            vectorizationConcurrency: parseInt(
                process.env.EMBEDDING_VECTORIZATION_CONCURRENCY || '1',
                10,
            ),
            vectorizationNormalize:
                process.env.EMBEDDING_VECTORIZATION_NORMALIZE !== 'false',

            databaseProvider:
                (process.env.EMBEDDING_DATABASE_PROVIDER as
                    | 'weaviate'
                    | 'pinecone'
                    | 'qdrant') || 'weaviate',
            databaseUrl:
                process.env.EMBEDDING_DATABASE_URL || 'http://weaviate:8080',
            databaseApiKey: process.env.EMBEDDING_DATABASE_API_KEY,
            databaseClassName:
                process.env.EMBEDDING_DATABASE_CLASS_NAME || 'Embeddings',
            databaseTimeout: parseInt(
                process.env.EMBEDDING_DATABASE_TIMEOUT || '30000',
                10,
            ),
            databaseBatchSize: parseInt(
                process.env.EMBEDDING_DATABASE_BATCH_SIZE || '100',
                10,
            ),

            textProcessingMinLength: parseInt(
                process.env.EMBEDDING_TEXT_MIN_LENGTH || '3',
                10,
            ),
            textProcessingMaxLength: parseInt(
                process.env.EMBEDDING_TEXT_MAX_LENGTH || '50000',
                10,
            ),
            textProcessingMinSectionLength: parseInt(
                process.env.EMBEDDING_TEXT_MIN_SECTION_LENGTH || '10',
                10,
            ),
            textProcessingNormalizeWhitespace:
                process.env.EMBEDDING_TEXT_NORMALIZE_WHITESPACE !== 'false',
            textProcessingRemoveUrls:
                process.env.EMBEDDING_TEXT_REMOVE_URLS !== 'false',
            textProcessingRemoveEmails:
                process.env.EMBEDDING_TEXT_REMOVE_EMAILS !== 'false',
            textProcessingCleanPunctuation:
                process.env.EMBEDDING_TEXT_CLEAN_PUNCTUATION !== 'false',
            textProcessingRemoveEmojis:
                process.env.EMBEDDING_TEXT_REMOVE_EMOJIS !== 'false',
            textProcessingRemoveControlChars:
                process.env.EMBEDDING_TEXT_REMOVE_CONTROL_CHARS !== 'false',
            textProcessingRemoveStopWords:
                process.env.EMBEDDING_TEXT_REMOVE_STOP_WORDS !== 'false',
            textProcessingAutoDetectSections:
                process.env.EMBEDDING_TEXT_AUTO_DETECT_SECTIONS !== 'false',

            searchDefaultLimit: parseInt(
                process.env.EMBEDDING_SEARCH_DEFAULT_LIMIT || '3',
                10,
            ),
            searchDefaultThreshold: parseFloat(
                process.env.EMBEDDING_SEARCH_DEFAULT_THRESHOLD || '0.7',
            ),
            searchMaxLimit: parseInt(
                process.env.EMBEDDING_SEARCH_MAX_LIMIT || '100',
                10,
            ),
            searchHybridAlpha: parseFloat(
                process.env.EMBEDDING_SEARCH_HYBRID_ALPHA || '0.35',
            ),
        },

        metrics: {
            logRetentionDays: parseInt(
                process.env.METRICS_LOG_RETENTION_DAYS || '30',
                10,
            ),
        },

        retention: {
            feedbackDays: parseInt(
                process.env.FEEDBACK_RETENTION_DAYS || '90',
                10,
            ),
            actionLogDays: parseInt(
                process.env.ACTION_LOG_RETENTION_DAYS || '90',
                10,
            ),
            audioTempCleanupHours: parseInt(
                process.env.AUDIO_TEMP_CLEANUP_HOURS || '1',
                10,
            ),
        },

        security: security.config,
    };
});
