import { z } from 'zod';

export const secretsSchema = z.object({
    // CMS locales
    CMS_LOCALES_TIMEOUT: z.coerce.number().default(10000),
    CMS_LOCALES_CACHE_TTL: z.coerce.number().default(300),

    // Postgres settings
    POSTGRES_URL: z.string().min(1, { message: 'POSTGRES_URL is required' }),
    POSTGRES_MAX_POOL_SIZE: z.coerce.number().default(10),
    POSTGRES_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
    POSTGRES_CONNECTION_TIMEOUT_MS: z.coerce.number().default(5000),
    POSTGRES_SSL: z.preprocess(
        (val) => val === 'true' || val === true,
        z.boolean().default(false),
    ),

    // Redis settings
    REDIS_HOST: z.string().min(1, { message: 'REDIS_HOST is required' }),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().default(''),
    REDIS_DB: z.coerce.number().default(0),
    REDIS_TTL: z.coerce.number().default(3600),

    // Site assistant actions cache
    CACHE_TTL_ACTIONS_SECONDS: z.coerce.number().default(300),
    CACHE_TYPE: z.enum(['redis', 'memory']).default('redis'),
    SITE_ASSISTANT_REINDEX_ON_STARTUP: z.preprocess(
        (val) => val === 'true' || val === true,
        z.boolean().default(false),
    ),

    // Site assistant crawler
    SITE_ASSISTANT_CRAWLER_BASE_URLS: z.string().optional(),
    SITE_ASSISTANT_CRAWLER_SITEMAP_PATH: z.string().default('/sitemap.xml'),
    SITE_ASSISTANT_CRAWLER_USER_AGENT: z
        .string()
        .default('SiteAssistantCrawler/1.0'),
    SITE_ASSISTANT_CRAWLER_MAX_PAGES: z.coerce.number().default(500),
    SITE_ASSISTANT_CRAWLER_MAX_DEPTH: z.coerce.number().default(3),
    SITE_ASSISTANT_CRAWLER_RATE_LIMIT_MS: z.coerce.number().default(200),
    SITE_ASSISTANT_CRAWLER_TIMEOUT_MS: z.coerce.number().default(10000),
    SITE_ASSISTANT_CRAWLER_RENDER_MODE: z
        .enum(['http', 'hybrid'])
        .default('hybrid'),
    SITE_ASSISTANT_CRAWLER_BROWSER_ENABLED: z.preprocess(
        (val) => val === 'true' || val === true,
        z.boolean().default(false),
    ),
    SITE_ASSISTANT_CRAWLER_BROWSER_TIMEOUT_MS: z.coerce.number().default(15000),
    SITE_ASSISTANT_CRAWLER_BROWSER_WAIT_UNTIL: z
        .enum(['domcontentloaded', 'load', 'networkidle'])
        .default('domcontentloaded'),
    SITE_ASSISTANT_CRAWLER_BROWSER_POST_LOAD_DELAY_MS: z.coerce
        .number()
        .default(1000),

    // Site assistant element index
    SITE_ASSISTANT_ELEMENT_INDEX_TOP_K: z.coerce.number().default(30),
    SITE_ASSISTANT_ELEMENT_INDEX_MIN_SIMILARITY: z.coerce.number().default(0),
    SITE_ASSISTANT_ELEMENT_INDEX_CLASS_NAME: z
        .string()
        .default('SiteElementsIndex'),
    SITE_ASSISTANT_ELEMENT_INDEX_TIMEOUT_MS: z.coerce.number().default(10000),
    SITE_ASSISTANT_ELEMENT_INDEX_HYBRID_ALPHA: z.coerce.number().default(0.35),

    // CORS settings
    CORS_ENABLED: z.preprocess(
        (val) => val === 'true' || val === true,
        z.boolean().default(true),
    ),
    CORS_ORIGINS: z.string().default('*'),

    // Rate limit settings
    RATE_LIMIT_TTL: z.coerce.number().default(60),
    RATE_LIMIT_MAX: z.coerce.number().default(100),

    // AI settings
    OPENROUTER_API_KEY: z
        .string()
        .min(1, { message: 'OPENROUTER_API_KEY is required' }),
    OPENROUTER_BASE_URL: z
        .string()
        .url()
        .default('https://openrouter.ai/api/v1'),
    MAX_BOT_TOKEN: z
        .string()
        .min(1, { message: 'MAX_BOT_TOKEN is required' }),
    MAX_BOT_API_BASE_URL: z
        .string()
        .url()
        .default('https://platform-api.max.ru'),
    MAX_WEBHOOK_SECRET: z
        .string()
        .min(1, { message: 'MAX_WEBHOOK_SECRET is required' }),
    MAX_WEBHOOK_PATH: z.string().default('/api/v1/max/webhook'),
    MAX_WEBHOOK_BASE_URL: z.string().url().optional(),
    AI_QUERY_CACHE_TTL: z.coerce.number().default(1800),
    YC_API_KEY: z.string().optional(),
    YC_IAM_TOKEN: z.string().optional(),
    IAM_TOKEN: z.string().optional(),
    YC_FOLDER_ID: z.string().optional(),
    FOLDER_ID: z.string().optional(),
    YC_TTS_ENDPOINT: z
        .string()
        .default(
            'https://tts.api.cloud.yandex.net:443/tts/v3/utteranceSynthesis',
        ),
    YC_TTS_TIMEOUT_MS: z.coerce.number().default(30000),
    YC_TTS_MAX_RETRIES: z.coerce.number().default(3),
    // AI Models
    COORDINATOR_AVAILABLE_MODELS: z.string().default('gpt-5.2'),
    ANALYTICS_AVAILABLE_MODELS: z.string().default('gpt-5.2'),
    RESPONSE_AVAILABLE_MODELS: z
        .string()
        .default('gpt-5.4-nano,gpt-5.4-mini,gpt-5.4'),
    SITE_ASSISTANT_AVAILABLE_MODELS: z
        .string()
        .default('gpt-5.4-nano,gpt-5.4-mini,gpt-5.4'),
    SUMMARIZATION_AVAILABLE_MODELS: z.string().default('gpt-5.2'),
    SPEECH_RECOGNITION_AVAILABLE_MODELS: z.string().default('gpt-audio-mini'),

    // HTTP settings
    HTTP_TIMEOUT: z.coerce.number().default(30000),
    MAX_RETRIES: z.coerce.number().default(3),

    // Real Estate API
    REAL_ESTATE_API_USERNAME: z.string().optional(),
    REAL_ESTATE_API_PASSWORD: z.string().optional(),
    REAL_ESTATE_API_BASE_URL: z.string().optional(),
    REAL_ESTATE_ORIGIN: z.string().optional(),
    REAL_ESTATE_API_TIMEOUT: z.coerce.number().default(10000),

    // Embedding settings
    EMBEDDING_VECTORIZATION_PROVIDER: z
        .enum(['ollama', 'openai', 'cohere'])
        .default('ollama'),
    EMBEDDING_VECTORIZATION_MODEL: z.string().default('nomic-embed-text-v2-moe'),
    EMBEDDING_VECTORIZATION_URL: z.string().default('http://ollama:11434'),
    EMBEDDING_VECTORIZATION_TIMEOUT: z.coerce.number().default(120000),
    EMBEDDING_VECTORIZATION_MAX_RETRIES: z.coerce.number().default(3),
    EMBEDDING_VECTORIZATION_BATCH_SIZE: z.coerce.number().default(8),
    EMBEDDING_VECTORIZATION_CONCURRENCY: z.coerce.number().default(1),
    EMBEDDING_VECTORIZATION_NORMALIZE: z.preprocess(
        (val) => val !== 'false',
        z.boolean().default(true),
    ),

    EMBEDDING_DATABASE_PROVIDER: z
        .enum(['weaviate', 'pinecone', 'qdrant'])
        .default('weaviate'),
    EMBEDDING_DATABASE_URL: z.string().default('http://weaviate:8080'),
    EMBEDDING_DATABASE_API_KEY: z.string().optional(),
    EMBEDDING_DATABASE_CLASS_NAME: z.string().default('Embeddings'),
    EMBEDDING_DATABASE_TIMEOUT: z.coerce.number().default(30000),
    EMBEDDING_DATABASE_BATCH_SIZE: z.coerce.number().default(100),

    EMBEDDING_TEXT_MIN_LENGTH: z.coerce.number().default(3),
    EMBEDDING_TEXT_MAX_LENGTH: z.coerce.number().default(50000),
    EMBEDDING_TEXT_MIN_SECTION_LENGTH: z.coerce.number().default(10),
    EMBEDDING_TEXT_NORMALIZE_WHITESPACE: z.preprocess(
        (val) => val !== 'false',
        z.boolean().default(true),
    ),
    EMBEDDING_TEXT_REMOVE_URLS: z.preprocess(
        (val) => val !== 'false',
        z.boolean().default(true),
    ),
    EMBEDDING_TEXT_REMOVE_EMAILS: z.preprocess(
        (val) => val !== 'false',
        z.boolean().default(true),
    ),
    EMBEDDING_TEXT_CLEAN_PUNCTUATION: z.preprocess(
        (val) => val !== 'false',
        z.boolean().default(true),
    ),
    EMBEDDING_TEXT_REMOVE_EMOJIS: z.preprocess(
        (val) => val !== 'false',
        z.boolean().default(true),
    ),
    EMBEDDING_TEXT_REMOVE_CONTROL_CHARS: z.preprocess(
        (val) => val !== 'false',
        z.boolean().default(true),
    ),
    EMBEDDING_TEXT_REMOVE_STOP_WORDS: z.preprocess(
        (val) => val !== 'false',
        z.boolean().default(true),
    ),
    EMBEDDING_TEXT_AUTO_DETECT_SECTIONS: z.preprocess(
        (val) => val !== 'false',
        z.boolean().default(true),
    ),

    EMBEDDING_SEARCH_DEFAULT_LIMIT: z.coerce.number().default(10),
    EMBEDDING_SEARCH_DEFAULT_THRESHOLD: z.coerce.number().default(0.7),
    EMBEDDING_SEARCH_MAX_LIMIT: z.coerce.number().default(100),
    EMBEDDING_SEARCH_HYBRID_ALPHA: z.coerce
        .number()
        .min(0)
        .max(1)
        .default(0.35),

    METRICS_LOG_RETENTION_DAYS: z.coerce.number().default(30),

    FEEDBACK_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    ACTION_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    AUDIO_TEMP_CLEANUP_HOURS: z.coerce.number().int().positive().default(1),
});

export type SecretsSchemaType = z.infer<typeof secretsSchema>;

export function validateSecretsConfig(
    config: Record<string, unknown>,
): SecretsSchemaType {
    return secretsSchema.parse(config);
}
