import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { generateUuid5 } from 'weaviate-ts-client';
import {
    averageVectors as averageVectorsUtil,
    buildSearchBaseText as buildSearchBaseTextUtil,
    calculateCosineSimilarity as calculateCosineSimilarityUtil,
    calculateEuclideanDistance as calculateEuclideanDistanceUtil,
    compareVectors as compareVectorsUtil,
    findMostSimilar as findMostSimilarUtil,
    isOrderChanged as isOrderChangedUtil,
    isOutdatedUpdate as isOutdatedUpdateUtil,
    normalizeMoveAfter as normalizeMoveAfterUtil,
    normalizeOrderValue as normalizeOrderValueUtil,
    normalizeSourceUpdatedAt as normalizeSourceUpdatedAtUtil,
    normalizeVector as normalizeVectorUtil,
    omitUndefined,
    parseDate as parseDateUtil,
    resolveSearchBaseOrder as resolveSearchBaseOrderUtil,
    sortByOrder as sortByOrderUtil,
} from '../../../infrastructure/vectorization/common/utils';
import { SecretsConfig } from 'src/infrastructure/config';
import { VectorizationService, TextProcessorService } from '../../../infrastructure/vectorization';
import {
    EMBEDDING_STATUS,
    VectorComparisonMethod,
    VECTOR_COMPARISON_METHOD,
} from 'src/infrastructure/vectorization/common/constants';
import {
    ProcessedEmbeddingResult,
    MetadataFilter,
    VectorComparisonResult,
    Metadata,
    MetadataRangeValue,
    MetadataValue,
} from 'src/infrastructure/vectorization/common/types';
import {
    SEARCH_BASE_VECTOR,
    SEARCH_BASE_UPSERT_STATUS,
} from '../common/constants';
import {
    SearchBaseSearchQuery,
    SearchBaseSearchResult,
    SearchBaseUpsertPayload,
    SearchBaseUpsertResult,
    SearchBaseUpsertItemResult,
    SearchBaseItemDetails,
    SearchBaseDeletePayload,
    SearchBaseDeleteResult,
    SearchBaseItemInput,
} from '../common/types';
import {
    EmbeddingServiceInterface,
    StoredEmbeddingResult,
    SearchOptions,
    SearchResult,
    EmbeddingStats,
    HealthStatus,
} from '../common/types/embedding.service.interface';
import { SearchBaseCatalogRepository } from '../repository';

@Injectable()
export class EmbeddingService implements EmbeddingServiceInterface {
    private readonly logger = new Logger(EmbeddingService.name);
    private readonly searchBaseDataset = SEARCH_BASE_VECTOR.DATASET;
    private readonly searchBaseContentType = SEARCH_BASE_VECTOR.CONTENT_TYPE;

    constructor(
        private readonly config: SecretsConfig,
        private readonly textProcessor: TextProcessorService,
        private readonly vectorization: VectorizationService,
        private readonly searchBaseCatalogRepo: SearchBaseCatalogRepository,
    ) {}

    async processAndEmbedText(
        inputText: string,
    ): Promise<ProcessedEmbeddingResult[]> {
        if (!inputText?.trim()) {
            throw new Error('Text cannot be empty');
        }

        const startTime = Date.now();
        const processedSections = this.textProcessor.processText(inputText);

        this.logger.log(
            `Text processed into ${processedSections.length} sections`,
        );

        const texts = processedSections.map((section) => section.text);
        const embeddings = await this.vectorization.generateBatchEmbeddings(
            texts,
            {
                source: 'search_base_process_text',
            },
        );

        const results: ProcessedEmbeddingResult[] = processedSections.map(
            (textData, index) => ({
                textData,
                embedding: embeddings[index],
                embeddingMetadata: {
                    dimensions: embeddings[index].length,
                    generationTime: 0,
                },
            }),
        );

        const totalTime = Date.now() - startTime;
        this.logger.log(
            `Processed and embedded ${results.length} sections in ${totalTime}ms`,
        );

        return results;
    }

    async storeEmbeddings(
        results: ProcessedEmbeddingResult[],
        source: string,
    ): Promise<StoredEmbeddingResult[]> {
        try {
            const items = results.map((result) => ({
                text: result.textData.text,
                vector: result.embedding,
                metadata: {
                    source,
                    sectionIndex: result.textData.sectionIndex,
                    totalSections: result.textData.totalSections,
                    length: result.textData.length,
                    compressionRatio:
                        result.textData.processing.compressionRatio,
                    wordsPreserved: result.textData.processing.wordsPreserved,
                    wordsRemoved: result.textData.processing.wordsRemoved,
                    embeddingDimensions: result.embeddingMetadata.dimensions,
                    generationTime: result.embeddingMetadata.generationTime,
                    hasMultipleSections: result.textData.hasMultipleSections,
                    sectionSeparator: result.textData.sectionSeparator,
                },
            }));

            const storedObjects = await this.vectorization
                .getVectorStore()
                .storeBatch(items);

            return storedObjects.map((stored) => ({
                id: stored.id,
                success: true,
                metadata: stored.metadata,
            }));
        } catch (error) {
            this.logger.error(
                `Failed to store embeddings: ${(error as Error).message}`,
            );
            return results.map(() => ({
                id: 'failed',
                success: false,
                error: (error as Error).message,
            }));
        }
    }

    async searchBase(
        query?: SearchBaseSearchQuery,
        options?: { preferOrder?: boolean },
    ): Promise<SearchBaseSearchResult> {
        const locale = query?.locale;
        if (!locale) {
            throw new Error('Locale is required');
        }

        const limit = Math.min(
            query?.limit || this.config.embedding.searchDefaultLimit,
            this.config.embedding.searchMaxLimit,
        );
        const page = Math.max(query?.page || 1, 1);
        const offset = (page - 1) * limit;
        const distance =
            typeof query?.minSimilarity === 'number'
                ? 1 - query.minSimilarity
                : this.config.embedding.searchDefaultThreshold;

        const queryText = query?.query?.trim();
        if (!queryText) {
            const catalogItems =
                await this.searchBaseCatalogRepo.listByLocale(locale);
            const sourceFilteredItems = query?.source
                ? catalogItems.filter((item) => item.source === query.source)
                : catalogItems;
            const orderedItems = options?.preferOrder
                ? sortByOrderUtil(sourceFilteredItems)
                : sourceFilteredItems;
            const totalItems = orderedItems.length;
            const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 1;
            const pagedItems =
                limit > 0
                    ? orderedItems.slice(offset, offset + limit)
                    : orderedItems;
            const items = pagedItems.map((item) => ({
                id: item.documentId,
                title: item.title || '',
                description: item.description || '',
                locale: item.locale || locale,
                source: item.source,
                url: item.url,
                updatedAt: item.sourceUpdatedAt,
                order: item.order,
            }));

            return {
                items,
                totalItems,
                totalPages,
                page,
                limit,
            };
        }

        const filters: MetadataFilter = {
            dataset: this.searchBaseDataset,
            contentType: this.searchBaseContentType,
            locale,
        };
        if (query?.source) {
            filters.source = query.source;
        }

        const store = this.vectorization.getVectorStore();

        const queryVector =
            await this.vectorization.generateEmbedding(queryText);

        const results = await store.search(queryVector, {
            limit,
            offset,
            distance,
            filters,
        });

        let orderMap = new Map<string, number>();
        if (options?.preferOrder) {
            const documentIds = results
                .map((result) => {
                    const documentId = result.metadata.documentId as
                        | string
                        | undefined;
                    return documentId || result.id;
                })
                .filter((id): id is string => Boolean(id));
            const catalogItems =
                await this.searchBaseCatalogRepo.findByDocumentIds(
                    query.locale,
                    documentIds,
                );
            orderMap = new Map(
                catalogItems
                    .filter((item) => typeof item.order === 'number')
                    .map((item) => [item.documentId, item.order as number]),
            );
        }

        let totalItems = results.length;
        try {
            totalItems = await store.count(queryVector, {
                distance,
                filters,
            });
        } catch (error) {
            this.logger.warn(
                `Search-base count failed, using result length: ${(error as Error).message}`,
            );
        }

        const items = results.map((result) => {
            const score = 1 - result.distance;
            return {
                id:
                    (result.metadata.documentId as string) ||
                    result.id ||
                    'unknown',
                title: (result.metadata.title as string) || '',
                description: (result.metadata.description as string) || '',
                locale: (result.metadata.locale as string) || query.locale,
                source: result.metadata.source as string | undefined,
                url: result.metadata.url as string | undefined,
                updatedAt: this.extractSourceUpdatedAt(result.metadata),
                order:
                    orderMap.get(
                        (result.metadata.documentId as string) || result.id,
                    ) ?? (result.metadata.order as number | undefined),
                score,
            };
        });
        const orderedItems = options?.preferOrder
            ? sortByOrderUtil(items)
            : items;

        const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 1;

        return {
            items: orderedItems,
            totalItems,
            totalPages,
            page,
            limit,
        };
    }

    async upsertSearchBase(
        payload: SearchBaseUpsertPayload,
    ): Promise<SearchBaseUpsertResult> {
        const sourceDefault =
            payload.source || SEARCH_BASE_VECTOR.DEFAULT_SOURCE;
        const store = this.vectorization.getVectorStore();
        const concurrency = this.resolveSearchBaseConcurrency(payload.data);

        this.logger.log(
            `Search-base upsert: ${payload.data.length} items (${payload.locale})`,
        );

        const results = await this.mapWithConcurrency(
            payload.data,
            concurrency,
            async (item, index): Promise<SearchBaseUpsertItemResult> => {
                const documentId = this.resolveSearchBaseDocumentId(item);
                if (!documentId) {
                    return {
                        id: 'unknown',
                        status: SEARCH_BASE_UPSERT_STATUS.FAILED,
                        reason: 'Document id is required',
                    };
                }
                try {
                    const vectorId = this.buildSearchBaseVectorId(
                        payload.locale,
                        documentId,
                    );
                    const combinedText = buildSearchBaseTextUtil(item);

                    if (!combinedText.trim()) {
                        return {
                            id: documentId,
                            status: SEARCH_BASE_UPSERT_STATUS.FAILED,
                            reason: 'Empty content',
                        };
                    }

                    const source = item.source || sourceDefault;
                    const contentHash = this.hashText(combinedText);
                    const sourceUpdatedAt = normalizeSourceUpdatedAtUtil(
                        item.updatedAt,
                    );

                    const [existingCatalog, existingVector] = await Promise.all(
                        [
                            this.searchBaseCatalogRepo.findByDocumentId(
                                payload.locale,
                                documentId,
                            ),
                            store.getById(vectorId),
                        ],
                    );

                    if (
                        existingVector &&
                        !this.isSearchBaseMetadata(existingVector.metadata)
                    ) {
                        return {
                            id: documentId,
                            status: SEARCH_BASE_UPSERT_STATUS.FAILED,
                            reason: 'Vector id collision with non search-base data',
                        };
                    }

                    const order = resolveSearchBaseOrderUtil({
                        item,
                        index,
                        storedOrder: existingCatalog?.order,
                        vectorOrder: existingVector?.metadata.order as
                            | number
                            | undefined,
                    });

                    const existingUpdatedAt =
                        existingCatalog?.sourceUpdatedAt ||
                        (existingVector?.metadata.sourceUpdatedAt as
                            | string
                            | undefined);
                    if (
                        isOutdatedUpdateUtil(existingUpdatedAt, sourceUpdatedAt)
                    ) {
                        return {
                            id: documentId,
                            status: SEARCH_BASE_UPSERT_STATUS.SKIPPED,
                            reason: 'Update is older than stored version',
                        };
                    }

                    const storedHash =
                        existingCatalog?.contentHash ||
                        (existingVector?.metadata.contentHash as
                            | string
                            | undefined);
                    const hasVector = Boolean(existingVector);
                    const catalogOrderChanged = isOrderChangedUtil(
                        existingCatalog?.order,
                        order,
                    );
                    const vectorOrderChanged = isOrderChangedUtil(
                        existingVector?.metadata.order as number | undefined,
                        order,
                    );
                    const orderChanged =
                        catalogOrderChanged || vectorOrderChanged;
                    const metadataChanged =
                        this.hasSearchBaseMetadataChanges({
                            existingCatalogValue: existingCatalog?.url,
                            existingVectorValue: existingVector?.metadata
                                .url as string | undefined,
                            nextValue: item.url,
                        }) ||
                        this.hasSearchBaseMetadataChanges({
                            existingCatalogValue: existingCatalog?.source,
                            existingVectorValue: existingVector?.metadata
                                .source as string | undefined,
                            nextValue: source,
                        }) ||
                        this.hasSearchBaseMetadataChanges({
                            existingCatalogValue:
                                existingCatalog?.sourceUpdatedAt,
                            existingVectorValue: existingVector?.metadata
                                .sourceUpdatedAt as string | undefined,
                            nextValue: sourceUpdatedAt,
                        });
                    const isUnchanged = storedHash === contentHash;
                    const needsEmbedding =
                        !hasVector ||
                        !isUnchanged ||
                        payload.skipIfUnchanged === false;
                    const needsMetadataUpdateOnly =
                        hasVector &&
                        isUnchanged &&
                        (orderChanged || metadataChanged);
                    const shouldSkipEmbedding =
                        hasVector &&
                        isUnchanged &&
                        !orderChanged &&
                        !metadataChanged &&
                        payload.skipIfUnchanged !== false;

                    await this.searchBaseCatalogRepo.upsert({
                        locale: payload.locale,
                        documentId,
                        externalId: item.id,
                        title: item.title,
                        description: item.description,
                        content: item.content,
                        url: item.url,
                        source,
                        contentHash,
                        sourceUpdatedAt,
                        contentLength: combinedText.length,
                        order,
                        embeddingStatus: needsEmbedding
                            ? EMBEDDING_STATUS.PENDING
                            : EMBEDDING_STATUS.READY,
                        embeddingError: needsEmbedding ? null : undefined,
                    });

                    if (shouldSkipEmbedding) {
                        return {
                            id: documentId,
                            status: SEARCH_BASE_UPSERT_STATUS.SKIPPED,
                            reason: 'Content is unchanged',
                        };
                    }

                    if (needsMetadataUpdateOnly && existingVector) {
                        await store.update(vectorId, undefined, {
                            ...existingVector.metadata,
                            order,
                            url: item.url,
                            source,
                            sourceUpdatedAt,
                        });
                        await this.searchBaseCatalogRepo.markEmbeddingReady(
                            payload.locale,
                            documentId,
                            {
                                vectorId,
                                contentLength: combinedText.length,
                                sectionCount:
                                    existingCatalog?.sectionCount ||
                                    (existingVector.metadata.sectionCount as
                                        | number
                                        | undefined) ||
                                    0,
                            },
                        );
                        return {
                            id: documentId,
                            status: SEARCH_BASE_UPSERT_STATUS.UPDATED,
                        };
                    }

                    const processedSections =
                        this.textProcessor.processText(combinedText);
                    if (processedSections.length === 0) {
                        await this.searchBaseCatalogRepo.markEmbeddingFailed(
                            payload.locale,
                            documentId,
                            'No text sections after processing',
                        );
                        return {
                            id: documentId,
                            status: SEARCH_BASE_UPSERT_STATUS.FAILED,
                            reason: 'No text sections after processing',
                        };
                    }

                    const texts = processedSections.map(
                        (section) => section.text,
                    );
                    const embeddings =
                        await this.vectorization.generateBatchEmbeddings(
                            texts,
                            {
                                source: 'search_base_upsert',
                            },
                        );
                    if (embeddings.length === 0) {
                        await this.searchBaseCatalogRepo.markEmbeddingFailed(
                            payload.locale,
                            documentId,
                            'Failed to generate embeddings',
                        );
                        return {
                            id: documentId,
                            status: SEARCH_BASE_UPSERT_STATUS.FAILED,
                            reason: 'Failed to generate embeddings',
                        };
                    }

                    const averaged = averageVectorsUtil(embeddings);
                    const vector = this.config.embedding.vectorizationNormalize
                        ? normalizeVectorUtil(averaged)
                        : averaged;

                    const metadata = this.buildSearchBaseMetadata({
                        locale: payload.locale,
                        source,
                        documentId,
                        externalId: item.id,
                        title: item.title,
                        description: item.description,
                        content: item.content,
                        url: item.url,
                        contentHash,
                        sectionCount: processedSections.length,
                        contentLength: combinedText.length,
                        sourceUpdatedAt,
                        order,
                    });

                    if (existingVector) {
                        await store.update(vectorId, vector, {
                            ...metadata,
                            text: combinedText,
                        });
                    } else {
                        await store.store(
                            combinedText,
                            vector,
                            metadata,
                            vectorId,
                        );
                    }

                    await this.searchBaseCatalogRepo.markEmbeddingReady(
                        payload.locale,
                        documentId,
                        {
                            vectorId,
                            contentLength: combinedText.length,
                            sectionCount: processedSections.length,
                        },
                    );

                    return {
                        id: documentId,
                        status: existingVector
                            ? SEARCH_BASE_UPSERT_STATUS.UPDATED
                            : SEARCH_BASE_UPSERT_STATUS.CREATED,
                    };
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : String(error);
                    try {
                        await this.searchBaseCatalogRepo.markEmbeddingFailed(
                            payload.locale,
                            documentId,
                            message,
                        );
                    } catch (innerError) {
                        const warn =
                            innerError instanceof Error
                                ? innerError.message
                                : String(innerError);
                        this.logger.warn(
                            `Failed to mark catalog error for ${documentId}: ${warn}`,
                        );
                    }
                    return {
                        id: documentId,
                        status: SEARCH_BASE_UPSERT_STATUS.FAILED,
                        reason: message,
                    };
                }
            },
        );

        const summary = results.reduce(
            (acc, result) => {
                acc.processed += 1;
                acc[result.status] += 1;
                return acc;
            },
            {
                locale: payload.locale,
                processed: 0,
                created: 0,
                updated: 0,
                skipped: 0,
                failed: 0,
            },
        );

        this.logger.log(
            `Search-base upsert completed: created=${summary.created}, updated=${summary.updated}, skipped=${summary.skipped}, failed=${summary.failed}`,
        );

        return {
            ...summary,
            results,
        };
    }

    async getSearchBaseItem(
        id: string,
        locale: string,
    ): Promise<SearchBaseItemDetails | null> {
        const catalog = await this.searchBaseCatalogRepo.findByDocumentId(
            locale,
            id,
        );
        if (catalog) {
            return {
                id: catalog.documentId,
                title: catalog.title || '',
                description: catalog.description || '',
                locale: catalog.locale || locale,
                source: catalog.source,
                url: catalog.url,
                updatedAt: catalog.sourceUpdatedAt,
                createdAt: catalog.createdAt?.toISOString(),
                contentLength: catalog.contentLength,
                sectionCount: catalog.sectionCount,
                order: catalog.order,
            };
        }

        const vectorId = this.buildSearchBaseVectorId(locale, id);
        const store = this.vectorization.getVectorStore();
        const existing = await store.getById(vectorId);

        if (!existing || !this.isSearchBaseMetadata(existing.metadata)) {
            return null;
        }

        return {
            id: (existing.metadata.documentId as string) || id,
            title: (existing.metadata.title as string) || '',
            description: (existing.metadata.description as string) || '',
            locale: (existing.metadata.locale as string) || locale,
            source: existing.metadata.source as string | undefined,
            url: existing.metadata.url as string | undefined,
            updatedAt: this.extractSourceUpdatedAt(existing.metadata),
            createdAt: existing.metadata.createdAt as string | undefined,
            contentLength: existing.metadata.contentLength as
                | number
                | undefined,
            sectionCount: existing.metadata.sectionCount as number | undefined,
            order: existing.metadata.order as number | undefined,
        };
    }

    async moveSearchBaseItem(
        id: string,
        locale: string,
        after: number,
    ): Promise<SearchBaseItemDetails | null> {
        const normalizedAfter = normalizeMoveAfterUtil(after);
        const catalogItems =
            await this.searchBaseCatalogRepo.listByLocale(locale);
        const items = sortByOrderUtil(catalogItems);
        if (items.length === 0) return null;

        const currentIndex = items.findIndex((item) => item.documentId === id);
        if (currentIndex === -1) return null;

        const [target] = items.splice(currentIndex, 1);
        const targetOrder =
            normalizeOrderValueUtil(target.order) ?? currentIndex + 1;
        let insertIndex = 0;

        if (normalizedAfter > 0) {
            let afterIndex = -1;
            for (let i = items.length - 1; i >= 0; i -= 1) {
                const itemOrder = normalizeOrderValueUtil(items[i].order);
                if (itemOrder === normalizedAfter) {
                    afterIndex = i;
                    break;
                }
            }

            if (afterIndex >= 0) {
                insertIndex = afterIndex + 1;
            } else if (normalizedAfter === targetOrder) {
                insertIndex = Math.min(currentIndex, items.length);
            } else {
                insertIndex = items.length;
            }
        }

        items.splice(insertIndex, 0, target);

        await this.searchBaseCatalogRepo.updateOrders(
            locale,
            items.map((item) => item.documentId),
        );
        await this.syncSearchBaseVectorOrders(locale, items);

        const updatedOrder = insertIndex + 1;

        return {
            id: target.documentId,
            title: target.title || '',
            description: target.description || '',
            locale: target.locale || locale,
            source: target.source,
            url: target.url,
            updatedAt: target.sourceUpdatedAt,
            createdAt: target.createdAt?.toISOString(),
            contentLength: target.contentLength,
            sectionCount: target.sectionCount,
            order: updatedOrder,
        };
    }

    async deleteSearchBaseById(id: string, locale: string): Promise<boolean> {
        const vectorId = this.buildSearchBaseVectorId(locale, id);
        const store = this.vectorization.getVectorStore();
        const existing = await store.getById(vectorId);
        const catalogDeleted =
            await this.searchBaseCatalogRepo.deleteByDocumentId(locale, id);
        let vectorDeleted = false;
        if (existing && this.isSearchBaseMetadata(existing.metadata)) {
            await store.deleteById(vectorId);
            vectorDeleted = true;
        }
        return catalogDeleted || vectorDeleted;
    }

    async deleteSearchBaseVectors(payload: {
        locale?: string;
        source?: string;
    }): Promise<number> {
        const filters: MetadataFilter = {
            dataset: this.searchBaseDataset,
            contentType: this.searchBaseContentType,
        };
        if (payload.locale) {
            filters.locale = payload.locale;
        }
        if (payload.source) {
            filters.source = payload.source;
        }

        return this.vectorization.getVectorStore().delete(filters);
    }

    async deleteSearchBase(
        payload: SearchBaseDeletePayload,
    ): Promise<SearchBaseDeleteResult> {
        const store = this.vectorization.getVectorStore();

        if (payload.ids?.length) {
            if (!payload.locale) {
                throw new Error('Locale is required for ids deletion');
            }

            const [catalogDeleted, vectorDeleted] = await Promise.all([
                this.searchBaseCatalogRepo.deleteByFilters({
                    locale: payload.locale,
                    documentIds: payload.ids,
                }),
                store.deleteByIds(
                    payload.ids.map((id) =>
                        this.buildSearchBaseVectorId(
                            payload.locale as string,
                            id,
                        ),
                    ),
                ),
            ]);
            return { deleted: Math.max(catalogDeleted, vectorDeleted) };
        }

        if (!payload.locale && !payload.source && !payload.updatedBefore) {
            throw new Error('At least one filter must be provided');
        }

        const filters: MetadataFilter = {
            dataset: this.searchBaseDataset,
            contentType: this.searchBaseContentType,
        };
        if (payload.locale) {
            filters.locale = payload.locale;
        }
        if (payload.source) {
            filters.source = payload.source;
        }
        if (payload.updatedBefore) {
            filters.sourceUpdatedAt = { before: payload.updatedBefore };
        }

        const [catalogDeleted, vectorDeleted] = await Promise.all([
            this.searchBaseCatalogRepo.deleteByFilters({
                locale: payload.locale,
                source: payload.source,
                updatedBefore: payload.updatedBefore,
            }),
            store.delete(filters),
        ]);
        return { deleted: Math.max(catalogDeleted, vectorDeleted) };
    }

    async searchSimilar(
        query: string,
        options: SearchOptions,
    ): Promise<SearchResult[]> {
        try {
            const searchResults = await this.vectorization.vectorizeAndSearch(
                query,
                {
                    limit:
                        options.limit ||
                        this.config.embedding.searchDefaultLimit,
                    distance:
                        options.threshold ||
                        this.config.embedding.searchDefaultThreshold,
                    filters: this.convertFilters(options.filters),
                    strategy: options.strategy,
                    queryText: options.hybridQuery ?? query,
                    hybridAlpha: options.hybridAlpha,
                    queryProperties: options.queryProperties,
                    signal: options.signal,
                },
            );

            return searchResults.map((result) => ({
                id: result.id,
                text: result.text,
                source: result.metadata.source ?? 'unknown',
                similarity: 1 - result.distance,
                metadata: {
                    sectionIndex: result.metadata.sectionIndex,
                    totalSections: result.metadata.totalSections,
                    length: result.metadata.length,
                    createdAt: result.metadata.createdAt,
                },
            }));
        } catch (error) {
            this.logger.error(
                `Vector search failed: ${(error as Error).message}`,
            );
            throw new Error(
                `Vector search failed: ${(error as Error).message}`,
            );
        }
    }

    async updateVector(
        id: string,
        text?: string,
        embedding?: number[],
        metadata?: Record<string, unknown>,
    ): Promise<StoredEmbeddingResult> {
        try {
            let finalEmbedding = embedding;

            if (text && !embedding) {
                finalEmbedding = await this.vectorization.generateEmbedding(
                    text,
                    {
                        source: 'search_base_update_vector',
                    },
                );
            }

            if (!finalEmbedding) {
                throw new Error('Either text or embedding must be provided');
            }

            const updatedVector = await this.vectorization
                .getVectorStore()
                .update(id, finalEmbedding, metadata);

            return {
                id: updatedVector.id,
                success: true,
                metadata: updatedVector.metadata,
            };
        } catch (error) {
            this.logger.error(`Update failed: ${(error as Error).message}`);
            return {
                id,
                success: false,
                error: (error as Error).message,
            };
        }
    }

    async getStats(): Promise<EmbeddingStats> {
        try {
            const stats = await this.vectorization.getStats();

            return {
                totalVectors: 0, // TODO: Calculate from store
                totalSources: 0, // TODO: Calculate from store
                averageProcessingTime: 0,
                vectorizationStats: {
                    model: stats.modelName || 'unknown',
                    dimensions: stats.modelDimensions || 0,
                    requestsPerMinute: 0,
                },
                databaseStats: {
                    totalVectors: stats.objectCount || 0,
                    indexStatus: stats.connected ? 'READY' : 'UNAVAILABLE',
                    responseTime: 0,
                },
            };
        } catch (error) {
            this.logger.error(
                `Failed to get stats`,
            );
            throw new Error(`Failed to get stats: ${error.message}`);
        }
    }

    async healthCheck(): Promise<HealthStatus> {
        const startTime = Date.now();
        const errors: string[] = [];

        try {
            const health = await this.vectorization.healthCheck();

            if (!health.provider) {
                errors.push('Vectorization service is not responding');
            }

            if (!health.store) {
                errors.push('Database service is not responding');
            }

            const responseTime = Date.now() - startTime;

            return {
                overall: health.healthy,
                vectorization: health.provider,
                database: health.store,
                errors: errors.length > 0 ? errors : undefined,
                responseTime,
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                overall: false,
                vectorization: false,
                database: false,
                errors: [error.message],
                responseTime,
            };
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        return this.vectorization.generateEmbedding(text);
    }

    async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
        return this.vectorization.generateBatchEmbeddings(texts);
    }

    calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
        return calculateCosineSimilarityUtil(vector1, vector2);
    }

    calculateEuclideanDistance(vector1: number[], vector2: number[]): number {
        return calculateEuclideanDistanceUtil(vector1, vector2);
    }

    compareVectors(
        vector1: number[],
        vector2: number[],
        method: VectorComparisonMethod = VECTOR_COMPARISON_METHOD.COSINE,
    ): VectorComparisonResult {
        return compareVectorsUtil(vector1, vector2, method);
    }

    findMostSimilar(
        queryVector: number[],
        candidateVectors: number[][],
        method: VectorComparisonMethod = VECTOR_COMPARISON_METHOD.COSINE,
        topK = 5,
    ): Array<{ index: number; similarity: number; distance: number }> {
        return findMostSimilarUtil(queryVector, candidateVectors, method, topK);
    }

    normalizeVector(vector: number[]): number[] {
        return normalizeVectorUtil(vector);
    }

    getConfig(): Readonly<typeof this.config> {
        return { ...this.config };
    }

    private resolveSearchBaseConcurrency(items: SearchBaseItemInput[]): number {
        const configured = Math.max(
            1,
            this.config.embedding.vectorizationBatchSize,
        );
        const bounded = Math.min(4, configured);
        return Math.min(Math.max(1, bounded), Math.max(1, items.length));
    }

    private async mapWithConcurrency<T, R>(
        items: T[],
        concurrency: number,
        mapper: (item: T, index: number) => Promise<R>,
    ): Promise<R[]> {
        if (items.length === 0) return [];

        const results = new Array<R>(items.length);
        let index = 0;

        const workers = new Array(Math.min(concurrency, items.length)).fill(
            null,
        );

        await Promise.all(
            workers.map(async () => {
                while (index < items.length) {
                    const current = index;
                    index += 1;
                    results[current] = await mapper(items[current], current);
                }
            }),
        );

        return results;
    }

    private resolveSearchBaseDocumentId(
        item: SearchBaseItemInput,
    ): string | null {
        if (typeof item.id !== 'string') {
            return null;
        }
        const normalized = item.id.trim();
        return normalized.length > 0 ? normalized : null;
    }

    private hasSearchBaseMetadataChanges(params: {
        existingCatalogValue?: string;
        existingVectorValue?: string;
        nextValue?: string;
    }): boolean {
        return (
            params.existingCatalogValue !== params.nextValue ||
            params.existingVectorValue !== params.nextValue
        );
    }

    private buildSearchBaseVectorId(
        locale: string,
        documentId: string,
    ): string {
        return generateUuid5(`${locale}:${documentId}`, this.searchBaseDataset);
    }

    private buildSearchBaseMetadata(params: {
        locale: string;
        source: string;
        documentId: string;
        externalId?: string;
        title: string;
        description: string;
        content?: string;
        url?: string;
        contentHash: string;
        sectionCount: number;
        contentLength: number;
        sourceUpdatedAt: string;
        order?: number;
    }): Metadata {
        return omitUndefined({
            dataset: this.searchBaseDataset,
            contentType: this.searchBaseContentType,
            documentId: params.documentId,
            externalId: params.externalId,
            locale: params.locale,
            source: params.source,
            title: params.title,
            description: params.description,
            content: params.content,
            url: params.url,
            contentHash: params.contentHash,
            sectionCount: params.sectionCount,
            contentLength: params.contentLength,
            sourceUpdatedAt: params.sourceUpdatedAt,
            order: params.order,
        }) as Metadata;
    }

    private hashText(text: string): string {
        return createHash('sha256').update(text).digest('hex');
    }

    private extractSourceUpdatedAt(metadata: Metadata): string | undefined {
        return (
            (metadata.sourceUpdatedAt as string | undefined) ||
            (metadata.updatedAt as string | undefined)
        );
    }

    private isSearchBaseMetadata(metadata: Metadata): boolean {
        return metadata.dataset === this.searchBaseDataset;
    }

    private convertFilters(filters?: Record<string, unknown>): MetadataFilter {
        if (!filters) return {};

        const converted: MetadataFilter = {};

        for (const [key, value] of Object.entries(filters)) {
            if (key === 'createdAfter' && value) {
                const date = parseDateUtil(value);
                if (!date) {
                    continue;
                }
                if (!isNaN(date.getTime())) {
                    const current = converted.createdAt;
                    const range: MetadataRangeValue =
                        typeof current === 'object' &&
                        current !== null &&
                        ('after' in current || 'before' in current)
                            ? current
                            : {};
                    converted.createdAt = { ...range, after: date };
                }
            } else if (key === 'createdBefore' && value) {
                const date = parseDateUtil(value);
                if (!date) {
                    continue;
                }
                if (!isNaN(date.getTime())) {
                    const current = converted.createdAt;
                    const range: MetadataRangeValue =
                        typeof current === 'object' &&
                        current !== null &&
                        ('after' in current || 'before' in current)
                            ? current
                            : {};
                    converted.createdAt = { ...range, before: date };
                }
            } else {
                converted[key] = value as MetadataValue;
            }
        }

        return converted;
    }

    private async syncSearchBaseVectorOrders(
        locale: string,
        orderedItems: Array<{ documentId: string; vectorId?: string }>,
    ): Promise<void> {
        const store = this.vectorization.getVectorStore();

        for (let index = 0; index < orderedItems.length; index += 1) {
            const item = orderedItems[index];
            const nextOrder = index + 1;
            const vectorId =
                item.vectorId ||
                this.buildSearchBaseVectorId(locale, item.documentId);

            try {
                const existingVector = await store.getById(vectorId);
                if (
                    !existingVector ||
                    !this.isSearchBaseMetadata(existingVector.metadata)
                ) {
                    continue;
                }

                const currentOrder = normalizeOrderValueUtil(
                    existingVector.metadata.order as number | undefined,
                );
                if (currentOrder === nextOrder) {
                    continue;
                }

                await store.update(
                    vectorId,
                    existingVector.vector.length > 0
                        ? existingVector.vector
                        : undefined,
                    {
                        ...existingVector.metadata,
                        order: nextOrder,
                        text: existingVector.text,
                        updatedAt: new Date().toISOString(),
                    },
                );
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                this.logger.warn(
                    `Failed to sync vector order for ${vectorId}: ${message}`,
                );
            }
        }
    }
}
