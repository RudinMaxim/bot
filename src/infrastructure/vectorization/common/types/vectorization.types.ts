import { Metadata, MetadataFilter, VectorStoreStats } from './api.types';

export interface EmbeddingProvider {
    generateEmbedding(
        text: string,
        options?: { signal?: AbortSignal; source?: string },
    ): Promise<number[]>;
    generateBatchEmbeddings(
        texts: string[],
        options?: { signal?: AbortSignal; source?: string },
    ): Promise<number[][]>;
    getModelInfo(): Promise<{ name: string; dimensions: number }>;
    healthCheck(): Promise<boolean>;
}

export interface VectorizeAndStoreOptions {
    metadata?: Metadata;
}

export interface VectorizeAndSearchOptions extends SearchOptions {
    metadata?: Metadata;
}

export interface VectorStoreObject {
    id: string;
    text: string;
    vector: number[];
    metadata: Metadata;
    createdAt: string;
    updatedAt: string;
}

export interface SearchOptions {
    limit?: number;
    offset?: number;
    distance?: number;
    filters?: MetadataFilter;
    strategy?: 'vector' | 'hybrid';
    queryText?: string;
    hybridAlpha?: number;
    queryProperties?: string[];
    signal?: AbortSignal;
}

export interface SearchResult {
    id: string;
    text: string;
    metadata: Metadata;
    distance: number;
}

export interface VectorStore {
    initialize(): Promise<void>;
    store(
        text: string,
        vector: number[],
        metadata: Metadata,
        id?: string,
    ): Promise<VectorStoreObject>;
    storeBatch(
        items: Array<{
            text: string;
            vector: number[];
            metadata: Metadata;
        }>,
    ): Promise<VectorStoreObject[]>;
    search(
        queryVector: number[],
        options?: SearchOptions,
    ): Promise<SearchResult[]>;
    count(queryVector?: number[], options?: SearchOptions): Promise<number>;
    delete(filters: MetadataFilter): Promise<number>;
    deleteById(id: string): Promise<boolean>;
    deleteByIds(ids: string[]): Promise<number>;
    getStats(): Promise<VectorStoreStats>;
    healthCheck(): Promise<boolean>;
    update(
        id: string,
        vector?: number[],
        metadata?: Record<string, unknown>,
    ): Promise<VectorStoreObject>;
    getById(id: string): Promise<VectorStoreObject | null>;
}

export interface VectorizationConfig {
    provider: {
        type: 'ollama' | 'openai' | 'cohere';
        url: string;
        model: string;
        timeout: number;
        maxRetries: number;
        batchSize: number;
        normalize: boolean;
    };
    store: {
        type: 'weaviate' | 'pinecone' | 'qdrant';
        url: string;
        apiKey?: string;
        className: string;
        timeout: number;
    };
}
