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
    AI_QUERY_CACHE_TTL: z.coerce.number().default(1800),
    // AI Models
    COORDINATOR_AVAILABLE_MODELS: z.string().default('gpt-5.2'),
    ANALYTICS_AVAILABLE_MODELS: z.string().default('gpt-5.2'),
    RESPONSE_AVAILABLE_MODELS: z
        .string()
        .default('gpt-5.4-nano,gpt-5.4-mini,gpt-5.4'),
    SUMMARIZATION_AVAILABLE_MODELS: z.string().default('gpt-5.2'),

    // HTTP settings
    HTTP_TIMEOUT: z.coerce.number().default(30000),
    MAX_RETRIES: z.coerce.number().default(3),

    // Embedding settings
    EMBEDDING_VECTORIZATION_PROVIDER: z
        .enum(['ollama', 'openai', 'cohere'])
        .default('ollama'),
    EMBEDDING_VECTORIZATION_MODEL: z.string().default('nomic-embed-text-v2-moe'),
    EMBEDDING_VECTORIZATION_URL: z.string().default('http://ollama:11435'),
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
    EMBEDDING_DATABASE_CLASS_NAME: z
        .string()
        .default('PsmuKnowledgeEmbeddings'),
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
});

export type SecretsSchemaType = z.infer<typeof secretsSchema>;

export function validateSecretsConfig(
    config: Record<string, unknown>,
): SecretsSchemaType {
    return secretsSchema.parse(config);
}
