export const EMBEDDING_STATUS = {
    PENDING: 'pending',
    READY: 'ready',
    FAILED: 'failed',
} as const;

export type EmbeddingStatus =
    (typeof EMBEDDING_STATUS)[keyof typeof EMBEDDING_STATUS];
