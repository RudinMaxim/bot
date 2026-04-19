import { ApiKey } from 'weaviate-ts-client';

export interface OllamaEmbeddingResponse {
    embedding?: number[];
    embeddings?: number[][];
}

export type OllamaApiResponse =
    | OllamaEmbeddingResponse
    | {
          data: OllamaEmbeddingResponse;
      };

export interface WeaviateAdditional {
    id: string;
    distance?: number;
    certainty?: number;
    score?: string;
    explainScore?: string;
}

export interface WeaviateObject {
    _additional: WeaviateAdditional;
    text: string;
    [key: string]: MetadataValue | WeaviateAdditional | string;
}

export interface WeaviateGraphQLResponse {
    data: {
        Get: {
            [className: string]: WeaviateObject[];
        };
    };
}

export interface WeaviateAggregateResponse {
    data: {
        Aggregate: {
            [className: string]: Array<{
                meta: {
                    count: number;
                };
            }>;
        };
    };
}

export interface WeaviateMetaResponse {
    version: string;
}

export interface WeaviateClientConfig {
    scheme: 'http' | 'https';
    host: string;
    timeout: number;
    apiKey?: ApiKey;
}

export type MetadataValue =
    | string
    | number
    | boolean
    | Date
    | null
    | undefined
    | string[]
    | number[]
    | boolean[];

export type MetadataRangeValue = {
    before?: Date | string;
    after?: Date | string;
};

export interface Metadata {
    [key: string]: MetadataValue;
}

export interface MetadataFilter {
    [key: string]: MetadataValue | MetadataRangeValue;
}

export interface VectorStoreStats {
    connected: boolean;
    version?: string;
    objectCount?: number;
    className?: string;
    error?: string;
    modelName?: string;
    modelDimensions?: number;
}

export interface WeaviateWhereCondition {
    path: string[];
    operator:
        | 'Equal'
        | 'NotEqual'
        | 'GreaterThan'
        | 'LessThan'
        | 'Like'
        | 'ContainsAny'
        | 'ContainsAll';
    valueText?: string;
    valueTextArray?: string[];
    valueNumber?: number;
    valueNumberArray?: number[];
    valueBoolean?: boolean;
    valueBooleanArray?: boolean[];
    valueDate?: string;
    valueDateArray?: string[];
}

export interface WeaviateWhereFilter {
    operator: 'And' | 'Or';
    operands: (WeaviateWhereCondition | WeaviateWhereFilter)[];
}

export type WeaviateWhere = WeaviateWhereCondition | WeaviateWhereFilter | null;
