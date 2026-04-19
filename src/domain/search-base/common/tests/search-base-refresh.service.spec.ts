import { SearchBaseRefreshService } from '../../services/search-base-refresh.service';

describe('SearchBaseRefreshService distributed lock', () => {
    const createService = () => {
        const redisService = {
            setIfNotExists: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
        };
        const embeddingService = {
            upsertSearchBase: jest.fn(),
            deleteSearchBaseVectors: jest.fn(),
        };
        const searchBaseCatalogRepo = {
            listForEmbeddingRefresh: jest.fn(),
        };
        const config = {
            embedding: {
                vectorizationBatchSize: 10,
            },
        };

        const service = new SearchBaseRefreshService(
            config as never,
            redisService as never,
            embeddingService as never,
            searchBaseCatalogRepo as never,
        );

        return {
            service,
            redisService,
            embeddingService,
            searchBaseCatalogRepo,
        };
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('skips run when distributed lock is already held', async () => {
        const { service, redisService, searchBaseCatalogRepo } = createService();
        redisService.setIfNotExists.mockResolvedValue(false);

        await service.refreshSearchBaseEmbeddings();

        expect(searchBaseCatalogRepo.listForEmbeddingRefresh).not.toHaveBeenCalled();
        expect(redisService.del).not.toHaveBeenCalled();
    });

    it('skips run when redis lock acquisition fails', async () => {
        const { service, redisService, searchBaseCatalogRepo } = createService();
        redisService.setIfNotExists.mockRejectedValue(new Error('redis down'));

        await service.refreshSearchBaseEmbeddings();

        expect(searchBaseCatalogRepo.listForEmbeddingRefresh).not.toHaveBeenCalled();
        expect(redisService.del).not.toHaveBeenCalled();
    });

    it('releases lock when the same owner still holds it', async () => {
        const { service, redisService, searchBaseCatalogRepo } = createService();
        redisService.setIfNotExists.mockResolvedValue(true);
        redisService.get.mockImplementation(
            async () => redisService.setIfNotExists.mock.calls[0]?.[1] ?? null,
        );
        searchBaseCatalogRepo.listForEmbeddingRefresh.mockResolvedValue([]);

        await service.refreshSearchBaseEmbeddings();

        expect(redisService.del).toHaveBeenCalledWith(
            'embedding:search-base-refresh:all',
        );
    });

    it('does not release lock if ownership changed', async () => {
        const { service, redisService, searchBaseCatalogRepo } = createService();
        redisService.setIfNotExists.mockResolvedValue(true);
        redisService.get.mockResolvedValue('another-owner');
        searchBaseCatalogRepo.listForEmbeddingRefresh.mockResolvedValue([]);

        await service.refreshSearchBaseEmbeddings({ locale: 'ru' });

        expect(redisService.del).not.toHaveBeenCalled();
    });

    it('deletes existing vectors before force refresh', async () => {
        const { service, redisService, embeddingService, searchBaseCatalogRepo } =
            createService();
        redisService.setIfNotExists.mockResolvedValue(true);
        redisService.get.mockResolvedValue(
            redisService.setIfNotExists.mock.calls[0]?.[1] ?? null,
        );
        embeddingService.deleteSearchBaseVectors.mockResolvedValue(12);
        searchBaseCatalogRepo.listForEmbeddingRefresh
            .mockResolvedValueOnce([
                {
                    id: 1,
                    locale: 'ru',
                    documentId: 'faq-001',
                    title: 'Q',
                    description: 'A',
                    content: 'A',
                },
            ])
            .mockResolvedValueOnce([]);
        embeddingService.upsertSearchBase.mockResolvedValue({
            created: 1,
            updated: 0,
            skipped: 0,
            failed: 0,
        });

        await service.refreshSearchBaseEmbeddings({ locale: 'ru', force: true });

        expect(embeddingService.deleteSearchBaseVectors).toHaveBeenCalledWith({
            locale: 'ru',
        });
        expect(embeddingService.upsertSearchBase).toHaveBeenCalled();
    });

    it('does not delete vectors during pending-only refresh', async () => {
        const { service, redisService, embeddingService, searchBaseCatalogRepo } =
            createService();
        redisService.setIfNotExists.mockResolvedValue(true);
        redisService.get.mockResolvedValue(
            redisService.setIfNotExists.mock.calls[0]?.[1] ?? null,
        );
        searchBaseCatalogRepo.listForEmbeddingRefresh.mockResolvedValue([]);

        await service.refreshSearchBaseEmbeddings({ locale: 'ru', force: false });

        expect(embeddingService.deleteSearchBaseVectors).not.toHaveBeenCalled();
    });
});
