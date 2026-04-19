export const EMBEDDING_STATS_QUERY_TYPE = {
    BASIC: 'basic',
    DETAILED: 'detailed',
    PERFORMANCE: 'performance',
} as const;

export type EmbeddingStatsQueryType =
    (typeof EMBEDDING_STATS_QUERY_TYPE)[keyof typeof EMBEDDING_STATS_QUERY_TYPE];

export const EMBEDDING_STATS_QUERY_TYPE_VALUES = Object.values(
    EMBEDDING_STATS_QUERY_TYPE,
) as EmbeddingStatsQueryType[];
