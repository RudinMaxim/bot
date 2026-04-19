import { SearchBaseCatalogRepository } from '../../repository/search-base.repository';

describe('SearchBaseCatalogRepository', () => {
    const createRepository = () => {
        const findOne = jest.fn();
        const find = jest.fn();
        const upsert = jest.fn();
        const findOneOrFail = jest.fn();
        const update = jest.fn();
        const deleteFn = jest.fn();
        const query = jest.fn();
        const qb = {
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getMany: jest.fn(),
            delete: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            execute: jest.fn(),
        };

        const RepositoryCtor =
            SearchBaseCatalogRepository as unknown as new (
                ...args: unknown[]
            ) => SearchBaseCatalogRepository;
        const repository = new RepositoryCtor(
            {
                findOne,
                find,
                upsert,
                findOneOrFail,
                update,
                delete: deleteFn,
                createQueryBuilder: jest.fn(() => qb),
            } as never,
            {
                query,
            } as never,
        );

        return {
            repository,
            findOne,
            find,
            upsert,
            findOneOrFail,
            update,
            deleteFn,
            query,
            qb,
        };
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('loads documents by locale and id through TypeORM repository', async () => {
        const entity = {
            id: '10',
            locale: 'ru',
            documentId: 'mys-object-overview-1',
            externalId: 'cms-10',
            title: 'Что такое ЖК "Мыс"?',
            description: 'ЖК "Мыс" - загородный квартал бизнес-класса',
            content: null,
            url: 'https://example.com/mys',
            source: null,
            contentHash: 'hash',
            sourceUpdatedAt: '2026-04-09T00:00:00.000Z',
            contentLength: 42,
            sectionCount: null,
            order: null,
            vectorId: null,
            embeddingStatus: 'pending',
            embeddingError: null,
            embeddingUpdatedAt: null,
            createdAt: new Date('2026-04-09T00:00:00.000Z'),
            updatedAt: new Date('2026-04-09T00:00:00.000Z'),
        };
        const { repository, findOne } = createRepository();
        findOne.mockResolvedValue(entity);

        const result = await repository.findByDocumentId(
            'ru',
            'mys-object-overview-1',
        );

        expect(findOne).toHaveBeenCalledWith({
            where: { locale: 'ru', documentId: 'mys-object-overview-1' },
        });
        expect(result).toEqual({
            id: 10,
            locale: 'ru',
            documentId: 'mys-object-overview-1',
            externalId: 'cms-10',
            title: 'Что такое ЖК "Мыс"?',
            description: 'ЖК "Мыс" - загородный квартал бизнес-класса',
            content: undefined,
            url: 'https://example.com/mys',
            source: undefined,
            contentHash: 'hash',
            sourceUpdatedAt: '2026-04-09T00:00:00.000Z',
            contentLength: 42,
            sectionCount: undefined,
            order: undefined,
            vectorId: undefined,
            embeddingStatus: 'pending',
            embeddingError: null,
            embeddingUpdatedAt: undefined,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        });
    });

    it('lists records by locale with null sort order last', async () => {
        const records = [
            {
                id: '1',
                locale: 'ru',
                documentId: 'doc-1',
                title: 'A',
                description: '',
                contentHash: 'hash-1',
                sourceUpdatedAt: '2026-04-08T00:00:00.000Z',
                contentLength: 1,
                order: 2,
                embeddingError: null,
                createdAt: new Date('2026-04-08T00:00:00.000Z'),
                updatedAt: new Date('2026-04-09T00:00:00.000Z'),
            },
            {
                id: '2',
                locale: 'ru',
                documentId: 'doc-2',
                title: 'B',
                description: '',
                contentHash: 'hash-2',
                sourceUpdatedAt: '2026-04-07T00:00:00.000Z',
                contentLength: 1,
                order: null,
                embeddingError: null,
                createdAt: new Date('2026-04-07T00:00:00.000Z'),
                updatedAt: new Date('2026-04-07T00:00:00.000Z'),
            },
            {
                id: '3',
                locale: 'ru',
                documentId: 'doc-3',
                title: 'C',
                description: '',
                contentHash: 'hash-3',
                sourceUpdatedAt: '2026-04-09T00:00:00.000Z',
                contentLength: 1,
                order: 1,
                embeddingError: null,
                createdAt: new Date('2026-04-09T00:00:00.000Z'),
                updatedAt: new Date('2026-04-09T00:00:00.000Z'),
            },
        ];
        const { repository, find } = createRepository();
        find.mockResolvedValue(records);

        const result = await repository.listByLocale('ru');

        expect(find).toHaveBeenCalledWith({
            where: { locale: 'ru' },
        });
        expect(result.map((item) => item.documentId)).toEqual([
            'doc-3',
            'doc-1',
            'doc-2',
        ]);
    });

    it('filters pending refresh candidates and applies locale and offset rules', async () => {
        const { repository, qb } = createRepository();
        qb.getMany.mockResolvedValue([
            {
                id: '2',
                locale: 'ru',
                documentId: 'pending',
                title: 'Pending',
                description: '',
                contentHash: 'hash-2',
                sourceUpdatedAt: '2026-04-09T00:00:00.000Z',
                contentLength: 1,
                order: 2,
                vectorId: null,
                embeddingStatus: 'ready',
                embeddingError: null,
                embeddingUpdatedAt: null,
                createdAt: new Date('2026-04-09T00:00:00.000Z'),
                updatedAt: new Date('2026-04-09T00:00:00.000Z'),
            },
            {
                id: '3',
                locale: 'ru',
                documentId: 'failed',
                title: 'Failed',
                description: '',
                contentHash: 'hash-3',
                sourceUpdatedAt: '2026-04-10T00:00:00.000Z',
                contentLength: 1,
                order: 3,
                vectorId: 'vec-3',
                embeddingStatus: 'failed',
                embeddingError: 'boom',
                embeddingUpdatedAt: '2026-04-10T00:00:00.000Z',
                createdAt: new Date('2026-04-10T00:00:00.000Z'),
                updatedAt: new Date('2026-04-10T00:00:00.000Z'),
            },
        ]);

        const result = await repository.listForEmbeddingRefresh(2, {
            locale: 'ru',
            afterId: 1,
            force: false,
        });

        expect(qb.where).toHaveBeenCalledWith('catalog.locale = :locale', {
            locale: 'ru',
        });
        expect(qb.andWhere).toHaveBeenCalledWith(
            '(catalog.embeddingStatus IS DISTINCT FROM :ready OR catalog.embeddingUpdatedAt IS NULL OR catalog.vectorId IS NULL)',
            { ready: 'ready' },
        );
        expect(qb.andWhere).toHaveBeenCalledWith('catalog.id > :afterId', {
            afterId: 1,
        });
        expect(qb.orderBy).toHaveBeenCalledWith('catalog.updatedAt', 'ASC');
        expect(qb.take).toHaveBeenCalledWith(2);
        expect(result.map((item) => item.documentId)).toEqual([
            'pending',
            'failed',
        ]);
    });

    it('orders forced refresh candidates by id and does not apply stale-state filter', async () => {
        const { repository, qb } = createRepository();
        qb.getMany.mockResolvedValue([
            {
                id: '4',
                locale: 'ru',
                documentId: 'forced',
                title: 'Forced',
                description: '',
                contentHash: 'hash-4',
                sourceUpdatedAt: '2026-04-11T00:00:00.000Z',
                contentLength: 1,
                order: 4,
                vectorId: 'vec-4',
                embeddingStatus: 'ready',
                embeddingError: null,
                embeddingUpdatedAt: '2026-04-11T00:00:00.000Z',
                createdAt: new Date('2026-04-11T00:00:00.000Z'),
                updatedAt: new Date('2026-04-11T00:00:00.000Z'),
            },
        ]);

        await repository.listForEmbeddingRefresh(1, {
            locale: 'ru',
            force: true,
            afterId: 3,
        });

        expect(qb.andWhere).toHaveBeenCalledWith('catalog.id > :afterId', {
            afterId: 3,
        });
        expect(qb.andWhere).not.toHaveBeenCalledWith(
            expect.stringContaining('embeddingStatus'),
            expect.anything(),
        );
        expect(qb.orderBy).toHaveBeenCalledWith('catalog.id', 'ASC');
    });

    it('upserts and reloads a mapped catalog record', async () => {
        const entity = {
            id: '20',
            locale: 'ru',
            documentId: 'doc-20',
            externalId: 'cms-20',
            title: 'Title',
            description: 'Description',
            content: 'Body',
            url: 'https://example.com/doc-20',
            source: 'cms',
            contentHash: 'hash-20',
            sourceUpdatedAt: '2026-04-09T00:00:00.000Z',
            contentLength: 99,
            sectionCount: 3,
            order: 5,
            vectorId: 'vec-20',
            embeddingStatus: 'pending',
            embeddingError: null,
            embeddingUpdatedAt: null,
            createdAt: new Date('2026-04-09T00:00:00.000Z'),
            updatedAt: new Date('2026-04-09T00:00:00.000Z'),
        };
        const { repository, upsert, findOneOrFail } = createRepository();
        upsert.mockResolvedValue(undefined);
        findOneOrFail.mockResolvedValue(entity);

        const result = await repository.upsert({
            locale: 'ru',
            documentId: 'doc-20',
            externalId: 'cms-20',
            title: 'Title',
            description: 'Description',
            content: 'Body',
            url: 'https://example.com/doc-20',
            source: 'cms',
            contentHash: 'hash-20',
            sourceUpdatedAt: '2026-04-09T00:00:00.000Z',
            contentLength: 99,
            sectionCount: 3,
            order: 5,
            vectorId: 'vec-20',
            embeddingStatus: 'pending',
        });

        expect(upsert).toHaveBeenCalledWith(
            {
                locale: 'ru',
                documentId: 'doc-20',
                externalId: 'cms-20',
                title: 'Title',
                description: 'Description',
                content: 'Body',
                url: 'https://example.com/doc-20',
                source: 'cms',
                contentHash: 'hash-20',
                sourceUpdatedAt: '2026-04-09T00:00:00.000Z',
                contentLength: 99,
                sectionCount: 3,
                order: 5,
                vectorId: 'vec-20',
                embeddingStatus: 'pending',
            },
            ['locale', 'documentId'],
        );
        expect(findOneOrFail).toHaveBeenCalledWith({
            where: { locale: 'ru', documentId: 'doc-20' },
        });
        expect(result).toEqual({
            id: 20,
            locale: 'ru',
            documentId: 'doc-20',
            externalId: 'cms-20',
            title: 'Title',
            description: 'Description',
            content: 'Body',
            url: 'https://example.com/doc-20',
            source: 'cms',
            contentHash: 'hash-20',
            sourceUpdatedAt: '2026-04-09T00:00:00.000Z',
            contentLength: 99,
            sectionCount: 3,
            order: 5,
            vectorId: 'vec-20',
            embeddingStatus: 'pending',
            embeddingError: null,
            embeddingUpdatedAt: undefined,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        });
    });

    it('updates ready and failed embedding states, removes records, and updates order', async () => {
        const entity = {
            id: '31',
            locale: 'ru',
            documentId: 'doc-31',
            externalId: null,
            title: 'Title',
            description: 'Description',
            content: null,
            url: null,
            source: null,
            contentHash: 'hash-31',
            sourceUpdatedAt: '2026-04-09T00:00:00.000Z',
            contentLength: 31,
            sectionCount: 2,
            order: 7,
            vectorId: 'vec-31',
            embeddingStatus: 'ready',
            embeddingError: null,
            embeddingUpdatedAt: '2026-04-09T00:00:00.000Z',
            createdAt: new Date('2026-04-09T00:00:00.000Z'),
            updatedAt: new Date('2026-04-09T00:00:00.000Z'),
        };
        const { repository, update, deleteFn, findOne, qb } =
            createRepository();
        update.mockResolvedValue({ affected: 1 });
        deleteFn.mockResolvedValue({ affected: 1 });
        findOne.mockResolvedValue(entity);
        qb.execute.mockResolvedValue({ affected: 1 });

        await repository.markEmbeddingReady('ru', 'doc-31', {
            vectorId: 'vec-31',
            contentLength: 32,
            sectionCount: 3,
        });
        await repository.markEmbeddingFailed('ru', 'doc-31', 'boom');
        const updated = await repository.updateOrder('ru', 'doc-31', 9);
        const deleted = await repository.deleteByDocumentId('ru', 'doc-31');
        const deletedByFilters = await repository.deleteByFilters({
            locale: 'ru',
            source: 'cms',
            updatedBefore: '2026-04-10T00:00:00.000Z',
            documentIds: ['doc-31'],
        });

        expect(update).toHaveBeenNthCalledWith(
            1,
            { locale: 'ru', documentId: 'doc-31' },
            expect.objectContaining({
                embeddingStatus: 'ready',
                embeddingError: null,
                vectorId: 'vec-31',
                contentLength: 32,
                sectionCount: 3,
            }),
        );
        expect(update).toHaveBeenNthCalledWith(
            2,
            { locale: 'ru', documentId: 'doc-31' },
            expect.objectContaining({
                embeddingStatus: 'failed',
                embeddingError: 'boom',
            }),
        );
        expect(updated).toEqual({
            id: 31,
            locale: 'ru',
            documentId: 'doc-31',
            externalId: undefined,
            title: 'Title',
            description: 'Description',
            content: undefined,
            url: undefined,
            source: undefined,
            contentHash: 'hash-31',
            sourceUpdatedAt: '2026-04-09T00:00:00.000Z',
            contentLength: 31,
            sectionCount: 2,
            order: 7,
            vectorId: 'vec-31',
            embeddingStatus: 'ready',
            embeddingError: null,
            embeddingUpdatedAt: '2026-04-09T00:00:00.000Z',
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        });
        expect(deleteFn).toHaveBeenNthCalledWith(1, {
            locale: 'ru',
            documentId: 'doc-31',
        });
        expect(qb.delete).toHaveBeenCalled();
        expect(qb.from).toHaveBeenCalled();
        expect(qb.where).toHaveBeenCalledWith('locale = :locale', {
            locale: 'ru',
        });
        expect(qb.andWhere).toHaveBeenCalledWith(
            'source = :source',
            {
                source: 'cms',
            },
        );
        expect(qb.andWhere).toHaveBeenCalledWith(
            'source_updated_at < :updatedBefore',
            {
                updatedBefore: '2026-04-10T00:00:00.000Z',
            },
        );
        expect(qb.andWhere).toHaveBeenCalledWith(
            'document_id IN (:...documentIds)',
            {
                documentIds: ['doc-31'],
            },
        );
        expect(deleted).toBe(true);
        expect(deletedByFilters).toBe(1);
    });

    it('uses EntityManager.query for bulk order updates', async () => {
        const { repository, query } = createRepository();
        query.mockResolvedValue(undefined);

        await repository.updateOrders('ru', ['doc-1', 'doc-2']);

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE search_base_catalog'),
            ['ru', ['doc-1', 'doc-2']],
        );
    });
});
