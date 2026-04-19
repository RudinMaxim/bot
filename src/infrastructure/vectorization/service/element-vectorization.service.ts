import { Injectable } from '@nestjs/common';
import type {
    MetadataFilter,
    SearchOptions,
    SearchResult,
    VectorStore,
    VectorStoreStats,
} from '../common/types';
import {
    OllamaEmbeddingProvider,
    WeaviateElementVectorStore,
} from '../common/providers';

@Injectable()
export class ElementVectorizationService {
    constructor(
        private readonly embeddingProvider: OllamaEmbeddingProvider,
        private readonly vectorStore: WeaviateElementVectorStore,
    ) {}

    async generateEmbedding(
        text: string,
        options?: { signal?: AbortSignal; source?: string },
    ): Promise<number[]> {
        return this.embeddingProvider.generateEmbedding(text, options);
    }

    async generateBatchEmbeddings(
        texts: string[],
        options?: { signal?: AbortSignal; source?: string },
    ): Promise<number[][]> {
        return this.embeddingProvider.generateBatchEmbeddings(texts, options);
    }

    async searchByVector(
        vector: number[],
        options: SearchOptions = {},
    ): Promise<SearchResult[]> {
        return this.vectorStore.search(vector, options);
    }

    async deleteVectors(filters: MetadataFilter): Promise<number> {
        return this.vectorStore.delete(filters);
    }

    getVectorStore(): VectorStore {
        return this.vectorStore;
    }

    async getStats(): Promise<VectorStoreStats> {
        const [storeStats, modelInfo] = await Promise.all([
            this.vectorStore.getStats(),
            this.embeddingProvider.getModelInfo(),
        ]);

        return {
            connected: storeStats.connected,
            version: storeStats.version,
            objectCount: storeStats.objectCount,
            className: storeStats.className,
            error: storeStats.error,
            modelName: modelInfo.name,
            modelDimensions: modelInfo.dimensions,
        };
    }

    async healthCheck(): Promise<{
        healthy: boolean;
        provider: boolean;
        store: boolean;
    }> {
        const [providerHealthy, storeHealthy] = await Promise.all([
            this.embeddingProvider.healthCheck().catch(() => false),
            this.vectorStore.healthCheck().catch(() => false),
        ]);

        return {
            healthy: providerHealthy && storeHealthy,
            provider: providerHealthy,
            store: storeHealthy,
        };
    }
}
