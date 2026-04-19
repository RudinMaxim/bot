import type { EmbeddingStatus } from 'src/infrastructure/vectorization/common/constants/embedding-status.const';

export const SEARCH_BASE_VECTOR = {
    DATASET: 'search-base',
    CONTENT_TYPE: 'document',
    DEFAULT_SOURCE: 'cms',
} as const;

export const SEARCH_BASE_UPSERT_STATUS = {
    CREATED: 'created',
    UPDATED: 'updated',
    SKIPPED: 'skipped',
    FAILED: 'failed',
} as const;

export type SearchBaseUpsertStatus =
    (typeof SEARCH_BASE_UPSERT_STATUS)[keyof typeof SEARCH_BASE_UPSERT_STATUS];

export const SEARCH_BASE_REFRESH_MODE = {
    FULL: 'full',
    PENDING: 'pending',
} as const;

export type SearchBaseRefreshMode =
    (typeof SEARCH_BASE_REFRESH_MODE)[keyof typeof SEARCH_BASE_REFRESH_MODE];

export const SEARCH_BASE_REFRESH_LOCK_PREFIX =
    'embedding:search-base-refresh' as const;

export type SearchBaseEmbeddingStatus = EmbeddingStatus;
