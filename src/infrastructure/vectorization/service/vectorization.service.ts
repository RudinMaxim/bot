import { Injectable, Logger } from '@nestjs/common';
import type {
    MetadataFilter,
    SearchOptions,
    SearchResult,
    VectorizeAndSearchOptions,
    VectorizeAndStoreOptions,
    VectorStore,
    VectorStoreObject,
    VectorStoreStats,
} from '../common/types';
import {
    OllamaEmbeddingProvider,
    WeaviateVectorStore,
} from '../common/providers';
import { redactForLog } from 'src/shared/security';

@Injectable()
export class VectorizationService {
    private readonly logger = new Logger(VectorizationService.name);

    constructor(
        private readonly embeddingProvider: OllamaEmbeddingProvider,
        private readonly vectorStore: WeaviateVectorStore,
    ) {}

    /**
     * Генерирует эмбеддинг для текста
     */
    async generateEmbedding(
        text: string,
        options?: { signal?: AbortSignal; source?: string },
    ): Promise<number[]> {
        return this.embeddingProvider.generateEmbedding(text, options);
    }

    /**
     * Генерирует эмбеддинги для массива текстов
     */
    async generateBatchEmbeddings(
        texts: string[],
        options?: { signal?: AbortSignal; source?: string },
    ): Promise<number[][]> {
        return this.embeddingProvider.generateBatchEmbeddings(texts, options);
    }

    /**
     * Генерирует эмбеддинг и сохраняет в векторное хранилище
     */
    async vectorizeAndStore(
        text: string,
        options: VectorizeAndStoreOptions = {},
    ): Promise<VectorStoreObject> {
        const startTime = Date.now();

        try {
            this.logger.debug(
                `Vectorizing text: ${redactForLog(text)}`,
            );

            const vector = await this.embeddingProvider.generateEmbedding(text);
            const generationTime = Date.now() - startTime;

            const metadata = {
                ...options.metadata,
                embeddingDimensions: vector.length,
                generationTime,
                length: text.length,
            };

            const result = await this.vectorStore.store(text, vector, metadata);

            this.logger.log(
                `Vectorized and stored (${generationTime}ms): ${result.id}`,
            );

            return result;
        } catch (error) {
            this.logger.error(`Vectorize and store failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Генерирует эмбеддинги для массива текстов и сохраняет батчем
     */
    async vectorizeAndStoreBatch(
        texts: string[],
        options: VectorizeAndStoreOptions = {},
    ): Promise<VectorStoreObject[]> {
        const startTime = Date.now();

        try {
            this.logger.debug(`Vectorizing batch of ${texts.length} texts`);

            const vectors =
                await this.embeddingProvider.generateBatchEmbeddings(texts);
            const generationTime = Date.now() - startTime;

            const items = texts.map((text, index) => ({
                text,
                vector: vectors[index],
                metadata: {
                    ...options.metadata,
                    embeddingDimensions: vectors[index].length,
                    generationTime: Math.round(generationTime / texts.length),
                    length: text.length,
                    batchIndex: index,
                    batchSize: texts.length,
                },
            }));

            const results = await this.vectorStore.storeBatch(items);

            this.logger.log(
                `Vectorized and stored batch of ${texts.length} (${generationTime}ms)`,
            );

            return results;
        } catch (error) {
            this.logger.error(
                `Batch vectorize and store failed: ${error.message}`,
            );
            throw error;
        }
    }

    /**
     * Генерирует эмбеддинг для запроса и выполняет семантический поиск
     */
    async vectorizeAndSearch(
        query: string,
        options: VectorizeAndSearchOptions = {},
    ): Promise<SearchResult[]> {
        try {
            this.logger.debug(`Vectorizing search query: ${redactForLog(query)}`);

            if (options.signal?.aborted) {
                throw Object.assign(new Error('cancelled'), {
                    code: 'CANCELLED',
                });
            }

            const queryVector = await this.embeddingProvider.generateEmbedding(
                query,
                { signal: options.signal },
            );

            const searchOptions: SearchOptions = {
                limit: options.limit,
                distance: options.distance,
                filters: options.filters,
                strategy: options.strategy,
                queryText: options.queryText ?? query,
                hybridAlpha: options.hybridAlpha,
                queryProperties: options.queryProperties,
                signal: options.signal,
            };

            if (options.signal?.aborted) {
                throw Object.assign(new Error('cancelled'), {
                    code: 'CANCELLED',
                });
            }

            const results = await this.vectorStore.search(
                queryVector,
                searchOptions,
            );

            this.logger.log(
                `Search completed: ${results.length} results for ${redactForLog(query)}`,
            );

            return results;
        } catch (error) {
            this.logger.error(`Vectorize and search failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Поиск по готовому вектору (без генерации эмбеддинга)
     */
    async searchByVector(
        vector: number[],
        options: SearchOptions = {},
    ): Promise<SearchResult[]> {
        return this.vectorStore.search(vector, options);
    }

    /**
     * Удаляет векторы по фильтрам
     */
    async deleteVectors(filters: MetadataFilter): Promise<number> {
        return this.vectorStore.delete(filters);
    }

    /**
     * Удаляет все векторы определенного источника
     */
    async deleteBySource(source: string): Promise<number> {
        return this.deleteVectors({ source });
    }

    /**
     * Прямой доступ к векторному хранилищу (для продвинутых кейсов)
     */
    getVectorStore(): VectorStore {
        return this.vectorStore;
    }

    /**
     * Получает статистику хранилища
     */
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

    /**
     * Проверяет здоровье всех компонентов
     */
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

    /**
     * Получает информацию о модели эмбеддингов
     */
    async getModelInfo(): Promise<{ name: string; dimensions: number }> {
        return this.embeddingProvider.getModelInfo();
    }
}
