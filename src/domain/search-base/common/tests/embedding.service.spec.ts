process.env.MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || 'token';
process.env.MAX_WEBHOOK_SECRET = process.env.MAX_WEBHOOK_SECRET || 'secret';

import { EmbeddingService } from '../../services/embedding.service';
import { VECTOR_COMPARISON_METHOD } from '../../../../infrastructure/vectorization/common/constants';
import { buildSearchBaseSeedFromAsset } from '../utils';

describe('EmbeddingService.moveSearchBaseItem', () => {
    const createService = () => {
        const store = {
            getById: jest.fn(),
            update: jest.fn(),
        };
        const vectorization = {
            getVectorStore: jest.fn(() => store),
        };
        const searchBaseCatalogRepo = {
            listByLocale: jest.fn(),
            updateOrders: jest.fn(),
        };
        const config = {
            embedding: {
                vectorizationBatchSize: 10,
                searchDefaultLimit: 20,
                searchMaxLimit: 100,
                searchDefaultThreshold: 0.3,
                vectorizationNormalize: true,
            },
        };

        const service = new EmbeddingService(
            config as never,
            {} as never,
            vectorization as never,
            searchBaseCatalogRepo as never,
        );

        return { service, store, searchBaseCatalogRepo };
    };

    it('updates vector orders for all reordered items', async () => {
        const { service, store, searchBaseCatalogRepo } = createService();
        searchBaseCatalogRepo.listByLocale.mockResolvedValue([
            {
                documentId: 'doc-1',
                order: 1,
                vectorId: 'vec-1',
                title: 'A',
                description: '',
                locale: 'ru',
                sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
            },
            {
                documentId: 'doc-2',
                order: 2,
                vectorId: 'vec-2',
                title: 'B',
                description: '',
                locale: 'ru',
                sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
            },
        ]);
        store.getById.mockImplementation(async (id: string) => {
            if (id === 'vec-1') {
                return {
                    id,
                    text: 'text-1',
                    vector: [1],
                    metadata: { dataset: 'search-base', order: 1 },
                };
            }
            if (id === 'vec-2') {
                return {
                    id,
                    text: 'text-2',
                    vector: [2],
                    metadata: { dataset: 'search-base', order: 2 },
                };
            }
            return null;
        });
        store.update.mockResolvedValue({
            id: 'ok',
            text: '',
            vector: [1],
            metadata: {},
            createdAt: '',
            updatedAt: '',
        });

        const result = await service.moveSearchBaseItem('doc-2', 'ru', 0);

        expect(searchBaseCatalogRepo.updateOrders).toHaveBeenCalledWith('ru', [
            'doc-2',
            'doc-1',
        ]);
        expect(store.update).toHaveBeenCalledTimes(2);
        const updatedOrders = store.update.mock.calls
            .map((call) => call[2].order)
            .sort((a, b) => a - b);
        expect(updatedOrders).toEqual([1, 2]);
        expect(result?.id).toBe('doc-2');
        expect(result?.order).toBe(1);
    });

    it('does not rewrite vectors when final order is unchanged', async () => {
        const { service, store, searchBaseCatalogRepo } = createService();
        searchBaseCatalogRepo.listByLocale.mockResolvedValue([
            {
                documentId: 'doc-1',
                order: 1,
                vectorId: 'vec-1',
                title: 'A',
                description: '',
                locale: 'ru',
                sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
            },
            {
                documentId: 'doc-2',
                order: 2,
                vectorId: 'vec-2',
                title: 'B',
                description: '',
                locale: 'ru',
                sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
            },
        ]);
        store.getById.mockImplementation(async (id: string) => ({
            id,
            text: `text-${id}`,
            vector: [1],
            metadata: { dataset: 'search-base', order: id === 'vec-1' ? 1 : 2 },
        }));
        store.update.mockResolvedValue({
            id: 'ok',
            text: '',
            vector: [1],
            metadata: {},
            createdAt: '',
            updatedAt: '',
        });

        const result = await service.moveSearchBaseItem('doc-2', 'ru', 1);

        expect(searchBaseCatalogRepo.updateOrders).toHaveBeenCalledWith('ru', [
            'doc-1',
            'doc-2',
        ]);
        expect(store.update).not.toHaveBeenCalled();
        expect(result?.order).toBe(2);
    });
});

describe('EmbeddingService.searchBase', () => {
    const createService = () => {
        const store = {
            search: jest.fn(),
            count: jest.fn(),
        };
        const vectorization = {
            getVectorStore: jest.fn(() => store),
            generateEmbedding: jest.fn(),
        };
        const searchBaseCatalogRepo = {
            listByLocale: jest.fn(),
            findByDocumentIds: jest.fn(),
        };
        const config = {
            embedding: {
                vectorizationBatchSize: 10,
                searchDefaultLimit: 20,
                searchMaxLimit: 100,
                searchDefaultThreshold: 0.3,
                vectorizationNormalize: true,
            },
        };

        const service = new EmbeddingService(
            config as never,
            {} as never,
            vectorization as never,
            searchBaseCatalogRepo as never,
        );

        return { service, store, vectorization, searchBaseCatalogRepo };
    };

    it('throws when locale is missing', async () => {
        const { service } = createService();

        await expect(service.searchBase({} as never)).rejects.toThrow(
            'Locale is required',
        );
    });

    it('sorts before pagination for empty query when preferOrder is enabled', async () => {
        const { service, searchBaseCatalogRepo } = createService();
        searchBaseCatalogRepo.listByLocale.mockResolvedValue([
            {
                documentId: 'doc-1',
                title: 'A',
                description: '',
                locale: 'ru',
                sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
                order: 3,
            },
            {
                documentId: 'doc-2',
                title: 'B',
                description: '',
                locale: 'ru',
                sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
                order: 1,
            },
            {
                documentId: 'doc-3',
                title: 'C',
                description: '',
                locale: 'ru',
                sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
                order: 2,
            },
        ]);

        const result = await service.searchBase(
            {
                locale: 'ru',
                limit: 2,
                page: 1,
            },
            { preferOrder: true },
        );

        expect(result.items.map((item) => item.id)).toEqual(['doc-2', 'doc-3']);
        expect(result.totalItems).toBe(3);
        expect(result.totalPages).toBe(2);
    });

    it('uses vector-store search/count and catalog order map for text query', async () => {
        const { service, store, vectorization, searchBaseCatalogRepo } =
            createService();
        vectorization.generateEmbedding.mockResolvedValue([0.1, 0.2]);
        store.search.mockResolvedValue([
            {
                id: 'v-1',
                text: 'first',
                distance: 0.3,
                metadata: {
                    documentId: 'doc-1',
                    title: 'First',
                    description: '',
                    locale: 'ru',
                },
            },
            {
                id: 'v-2',
                text: 'second',
                distance: 0.1,
                metadata: {
                    documentId: 'doc-2',
                    title: 'Second',
                    description: '',
                    locale: 'ru',
                },
            },
        ]);
        store.count.mockResolvedValue(2);
        searchBaseCatalogRepo.findByDocumentIds.mockResolvedValue([
            {
                documentId: 'doc-1',
                order: 2,
            },
            {
                documentId: 'doc-2',
                order: 1,
            },
        ]);

        const result = await service.searchBase(
            {
                locale: 'ru',
                query: 'find docs',
                limit: 10,
                minSimilarity: 0.95,
            },
            { preferOrder: true },
        );

        expect(vectorization.generateEmbedding).toHaveBeenCalledWith(
            'find docs',
        );
        expect(store.search).toHaveBeenCalledWith(
            [0.1, 0.2],
            expect.any(Object),
        );
        const [, searchOptions] = store.search.mock.calls[0] ?? [];
        expect(searchOptions).toMatchObject({
            limit: 10,
            offset: 0,
            filters: {
                dataset: 'search-base',
                contentType: 'document',
                locale: 'ru',
            },
        });
        expect(searchOptions?.distance).toBeCloseTo(0.05, 8);
        expect(searchBaseCatalogRepo.findByDocumentIds).toHaveBeenCalledWith(
            'ru',
            ['doc-1', 'doc-2'],
        );
        expect(result.items).toHaveLength(2);
        expect(result.items.map((item) => item.id)).toEqual(['doc-2', 'doc-1']);
        expect(result.totalItems).toBe(2);
    });

    it('keeps vector-comparison defaults available through constants', () => {
        expect(VECTOR_COMPARISON_METHOD.COSINE).toBe('cosine');
    });
});

describe('EmbeddingService.upsertSearchBase', () => {
    it('upserts embedding text separately from full KB card payload', async () => {
        const seed = buildSearchBaseSeedFromAsset({
            dataset: 'accreditation',
            locale: 'ru',
            version: 4,
            steps: [],
            items: [
                {
                    id: 'parking-underground',
                    category: 'parking',
                    title: 'Подземный паркинг',
                    queries: [
                        'есть ли паркинг',
                        'подземный паркинг',
                    ],
                    answer: 'В жилом комплексе предусмотрен подземный паркинг.',
                    guardrails: ['Не утверждать стоимость.'],
                    source: 'mys-curated',
                    order: 1,
                },
            ],
        } as never);

        const store = {
            getById: jest.fn().mockResolvedValue(null),
            store: jest.fn().mockResolvedValue({
                id: 'vec-1',
                text: '',
                vector: [1],
                metadata: {},
                createdAt: '',
                updatedAt: '',
            }),
        };
        const vectorization = {
            getVectorStore: jest.fn(() => store),
            generateBatchEmbeddings: jest.fn().mockResolvedValue([[1, 2, 3]]),
        };
        const searchBaseCatalogRepo = {
            findByDocumentId: jest.fn().mockResolvedValue(null),
            upsert: jest.fn().mockResolvedValue(undefined),
            markEmbeddingReady: jest.fn().mockResolvedValue(undefined),
            markEmbeddingFailed: jest.fn().mockResolvedValue(undefined),
        };
        const config = {
            embedding: {
                vectorizationBatchSize: 10,
                searchDefaultLimit: 20,
                searchMaxLimit: 100,
                searchDefaultThreshold: 0.3,
                vectorizationNormalize: true,
            },
        };
        const textProcessor = {
            processText: jest.fn().mockReturnValue([
                {
                    text: 'chunk-1',
                    sectionIndex: 0,
                    totalSections: 1,
                    length: 10,
                    processing: {
                        compressionRatio: 1,
                        wordsPreserved: 1,
                        wordsRemoved: 0,
                    },
                    hasMultipleSections: false,
                    sectionSeparator: '\n\n',
                },
            ]),
        };

        const service = new EmbeddingService(
            config as never,
            textProcessor as never,
            vectorization as never,
            searchBaseCatalogRepo as never,
        );

        const result = await service.upsertSearchBase({
            locale: 'ru',
            source: 'resource-asset',
            data: seed.data,
        });

        expect(textProcessor.processText).toHaveBeenCalledWith(
            [
                'title: Подземный паркинг',
                'queries: есть ли паркинг | подземный паркинг',
                'answer: В жилом комплексе предусмотрен подземный паркинг.',
            ].join('\n'),
        );
        expect(searchBaseCatalogRepo.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                locale: 'ru',
                documentId: 'parking-underground',
                title: 'Подземный паркинг',
                description:
                    'В жилом комплексе предусмотрен подземный паркинг.',
                content: expect.stringContaining('category: parking'),
            }),
        );
        expect(store.store).toHaveBeenCalledWith(
            [
                'title: Подземный паркинг',
                'queries: есть ли паркинг | подземный паркинг',
                'answer: В жилом комплексе предусмотрен подземный паркинг.',
            ].join('\n'),
            expect.any(Array),
            expect.objectContaining({
                content: expect.stringContaining(
                    'guardrails: Не утверждать стоимость.',
                ),
            }),
            expect.any(String),
        );
        expect(result.failed).toBe(0);
    });

    it('fails item when document id is missing instead of generating a new one', async () => {
        const store = {
            getById: jest.fn(),
            update: jest.fn(),
        };
        const vectorization = {
            getVectorStore: jest.fn(() => store),
        };
        const searchBaseCatalogRepo = {
            findByDocumentId: jest.fn(),
            upsert: jest.fn(),
            markEmbeddingReady: jest.fn(),
            markEmbeddingFailed: jest.fn(),
        };
        const config = {
            embedding: {
                vectorizationBatchSize: 10,
                searchDefaultLimit: 20,
                searchMaxLimit: 100,
                searchDefaultThreshold: 0.3,
                vectorizationNormalize: true,
            },
        };
        const textProcessor = {
            processText: jest.fn(),
        };

        const service = new EmbeddingService(
            config as never,
            textProcessor as never,
            vectorization as never,
            searchBaseCatalogRepo as never,
        );

        const result = await service.upsertSearchBase({
            locale: 'ru',
            source: 'cms',
            data: [
                {
                    id: null as never,
                    title: 'Title',
                    description: 'Description',
                    content: 'Body',
                    url: 'https://example.com/page',
                },
            ],
        });

        expect(result.failed).toBe(1);
        expect(result.results).toEqual([
            {
                id: 'unknown',
                status: 'failed',
                reason: 'Document id is required',
            },
        ]);
        expect(searchBaseCatalogRepo.upsert).not.toHaveBeenCalled();
        expect(textProcessor.processText).not.toHaveBeenCalled();
    });

    it('updates metadata-only records without sending empty vector back to store', async () => {
        const store = {
            getById: jest.fn().mockResolvedValue({
                id: 'vec-1',
                text: 'combined text',
                vector: [],
                metadata: {
                    dataset: 'search-base',
                    documentId: 'cms-1',
                    order: 1,
                    sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
                },
            }),
            update: jest.fn().mockResolvedValue({
                id: 'vec-1',
                text: 'combined text',
                vector: [],
                metadata: {},
                createdAt: '',
                updatedAt: '',
            }),
        };
        const vectorization = {
            getVectorStore: jest.fn(() => store),
        };
        const searchBaseCatalogRepo = {
            findByDocumentId: jest.fn().mockResolvedValue({
                documentId: 'cms-1',
                contentHash: 'same-hash',
                order: 1,
                sectionCount: 2,
                sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
            }),
            upsert: jest.fn().mockResolvedValue(undefined),
            markEmbeddingReady: jest.fn().mockResolvedValue(undefined),
            markEmbeddingFailed: jest.fn().mockResolvedValue(undefined),
        };
        const config = {
            embedding: {
                vectorizationBatchSize: 10,
                searchDefaultLimit: 20,
                searchMaxLimit: 100,
                searchDefaultThreshold: 0.3,
                vectorizationNormalize: true,
            },
        };
        const textProcessor = {
            processText: jest.fn().mockReturnValue([{ text: 'combined text' }]),
        };

        const service = new EmbeddingService(
            config as never,
            textProcessor as never,
            vectorization as never,
            searchBaseCatalogRepo as never,
        );
        jest.spyOn(service as any, 'hashText').mockReturnValue('same-hash');

        const result = await service.upsertSearchBase({
            locale: 'ru',
            source: 'cms',
            data: [
                {
                    id: 'cms-1',
                    title: 'Title',
                    description: 'Description',
                    content: 'combined text',
                    url: 'https://example.com/page',
                    updatedAt: '2025-01-01T00:00:00.000Z',
                    order: 2,
                },
            ],
        });

        expect(store.update).toHaveBeenCalledWith(
            expect.any(String),
            undefined,
            expect.objectContaining({
                order: 2,
                url: 'https://example.com/page',
                source: 'cms',
                sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
            }),
        );
        expect(result.updated).toBe(1);
        expect(result.failed).toBe(0);
    });

    it('returns updated when only url changes without re-embedding content', async () => {
        const store = {
            getById: jest.fn().mockResolvedValue({
                id: 'vec-1',
                text: 'combined text',
                vector: [1],
                metadata: {
                    dataset: 'search-base',
                    documentId: 'cms-1',
                    url: 'https://example.com/page',
                    source: 'cms',
                    order: 1,
                    sectionCount: 2,
                    sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
                },
            }),
            update: jest.fn().mockResolvedValue({
                id: 'vec-1',
                text: 'combined text',
                vector: [1],
                metadata: {},
                createdAt: '',
                updatedAt: '',
            }),
        };
        const vectorization = {
            getVectorStore: jest.fn(() => store),
            generateBatchEmbeddings: jest.fn(),
        };
        const searchBaseCatalogRepo = {
            findByDocumentId: jest.fn().mockResolvedValue({
                documentId: 'cms-1',
                contentHash: 'same-hash',
                url: 'https://example.com/page',
                source: 'cms',
                order: 1,
                sectionCount: 2,
                sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
            }),
            upsert: jest.fn().mockResolvedValue(undefined),
            markEmbeddingReady: jest.fn().mockResolvedValue(undefined),
            markEmbeddingFailed: jest.fn().mockResolvedValue(undefined),
        };
        const config = {
            embedding: {
                vectorizationBatchSize: 10,
                searchDefaultLimit: 20,
                searchMaxLimit: 100,
                searchDefaultThreshold: 0.3,
                vectorizationNormalize: true,
            },
        };
        const textProcessor = {
            processText: jest.fn().mockReturnValue([{ text: 'combined text' }]),
        };

        const service = new EmbeddingService(
            config as never,
            textProcessor as never,
            vectorization as never,
            searchBaseCatalogRepo as never,
        );
        jest.spyOn(service as any, 'hashText').mockReturnValue('same-hash');

        const result = await service.upsertSearchBase({
            locale: 'ru',
            source: 'cms',
            data: [
                {
                    id: 'cms-1',
                    title: 'Title',
                    description: 'Description',
                    content: 'combined text',
                    url: 'https://example.com/page3',
                    updatedAt: '2025-01-01T00:00:00.000Z',
                    order: 1,
                },
            ],
        });

        expect(result.updated).toBe(1);
        expect(result.skipped).toBe(0);
        expect(store.update).toHaveBeenCalledWith(
            expect.any(String),
            undefined,
            expect.objectContaining({
                url: 'https://example.com/page3',
                source: 'cms',
                sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
            }),
        );
        expect(vectorization.generateBatchEmbeddings).not.toHaveBeenCalled();
    });

    it('retries metadata-only update when catalog order changed but vector metadata is stale', async () => {
        const store = {
            getById: jest.fn().mockResolvedValue({
                id: 'vec-1',
                text: 'combined text',
                vector: [],
                metadata: {
                    dataset: 'search-base',
                    documentId: 'cms-1',
                    url: 'https://example.com/page',
                    source: 'cms',
                    order: 1,
                    sectionCount: 2,
                    sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
                },
            }),
            update: jest.fn().mockResolvedValue({
                id: 'vec-1',
                text: 'combined text',
                vector: [],
                metadata: {},
                createdAt: '',
                updatedAt: '',
            }),
        };
        const vectorization = {
            getVectorStore: jest.fn(() => store),
            generateBatchEmbeddings: jest.fn(),
        };
        const searchBaseCatalogRepo = {
            findByDocumentId: jest.fn().mockResolvedValue({
                documentId: 'cms-1',
                contentHash: 'same-hash',
                url: 'https://example.com/page',
                source: 'cms',
                order: 2,
                sectionCount: 2,
                sourceUpdatedAt: '2025-01-01T00:00:00.000Z',
            }),
            upsert: jest.fn().mockResolvedValue(undefined),
            markEmbeddingReady: jest.fn().mockResolvedValue(undefined),
            markEmbeddingFailed: jest.fn().mockResolvedValue(undefined),
        };
        const config = {
            embedding: {
                vectorizationBatchSize: 10,
                searchDefaultLimit: 20,
                searchMaxLimit: 100,
                searchDefaultThreshold: 0.3,
                vectorizationNormalize: true,
            },
        };
        const textProcessor = {
            processText: jest.fn().mockReturnValue([{ text: 'combined text' }]),
        };

        const service = new EmbeddingService(
            config as never,
            textProcessor as never,
            vectorization as never,
            searchBaseCatalogRepo as never,
        );
        jest.spyOn(service as any, 'hashText').mockReturnValue('same-hash');

        const result = await service.upsertSearchBase({
            locale: 'ru',
            source: 'cms',
            data: [
                {
                    id: 'cms-1',
                    title: 'Title',
                    description: 'Description',
                    content: 'combined text',
                    url: 'https://example.com/page',
                    updatedAt: '2025-01-01T00:00:00.000Z',
                    order: 2,
                },
            ],
        });

        expect(result.updated).toBe(1);
        expect(result.skipped).toBe(0);
        expect(store.update).toHaveBeenCalledWith(
            expect.any(String),
            undefined,
            expect.objectContaining({
                order: 2,
            }),
        );
        expect(vectorization.generateBatchEmbeddings).not.toHaveBeenCalled();
    });
});

describe('EmbeddingService.searchSimilar', () => {
    it('passes hybrid search options to vectorization service', async () => {
        const vectorization = {
            vectorizeAndSearch: jest.fn().mockResolvedValue([
                {
                    id: 'doc-1',
                    text: 'Документ',
                    distance: 0.2,
                    metadata: {
                        source: 'kb',
                        sectionIndex: 0,
                        totalSections: 1,
                        length: 120,
                        createdAt: '2025-01-01T00:00:00.000Z',
                    },
                },
            ]),
        };
        const config = {
            embedding: {
                searchDefaultLimit: 20,
                searchDefaultThreshold: 0.3,
            },
        };

        const service = new EmbeddingService(
            config as never,
            {} as never,
            vectorization as never,
            {} as never,
        );

        const result = await service.searchSimilar('семантический запрос', {
            limit: 7,
            threshold: 0.55,
            strategy: 'hybrid',
            hybridAlpha: 0.35,
            hybridQuery: 'точный запрос',
            queryProperties: ['title', 'content'],
        });

        expect(vectorization.vectorizeAndSearch).toHaveBeenCalledWith(
            'семантический запрос',
            expect.objectContaining({
                limit: 7,
                distance: 0.55,
                strategy: 'hybrid',
                queryText: 'точный запрос',
                hybridAlpha: 0.35,
                queryProperties: ['title', 'content'],
            }),
        );
        expect(result).toEqual([
            expect.objectContaining({
                id: 'doc-1',
                similarity: 0.8,
                source: 'kb',
            }),
        ]);
    });
});

describe('EmbeddingService.deleteSearchBaseVectors', () => {
    it('deletes only vector store entries for the search-base dataset and locale', async () => {
        const store = {
            delete: jest.fn().mockResolvedValue(7),
        };
        const vectorization = {
            getVectorStore: jest.fn(() => store),
        };
        const config = {
            embedding: {
                searchDefaultLimit: 20,
                searchDefaultThreshold: 0.3,
            },
        };

        const service = new EmbeddingService(
            config as never,
            {} as never,
            vectorization as never,
            {} as never,
        );

        const deleted = await service.deleteSearchBaseVectors({
            locale: 'ru',
        });

        expect(deleted).toBe(7);
        expect(store.delete).toHaveBeenCalledWith({
            dataset: 'search-base',
            contentType: 'document',
            locale: 'ru',
        });
    });
});
