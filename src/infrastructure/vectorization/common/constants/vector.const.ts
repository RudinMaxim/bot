export const VECTOR_COMPARISON_METHOD = {
    COSINE: 'cosine',
    EUCLIDEAN: 'euclidean',
    DOT: 'dot',
} as const;

export type VectorComparisonMethod =
    (typeof VECTOR_COMPARISON_METHOD)[keyof typeof VECTOR_COMPARISON_METHOD];
