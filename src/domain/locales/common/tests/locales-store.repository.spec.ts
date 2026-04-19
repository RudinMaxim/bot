import { LocalesStoreRepository } from '../../repository/locales-store.repository';

describe('LocalesStoreRepository', () => {
    it('loads locale settings records through TypeORM repository', async () => {
        const entity = {
            id: '7',
            locale: 'ru',
            data: { system: { ok: true } },
            version: 'md5:test',
            createdAt: new Date('2026-04-08T00:00:00.000Z'),
            updatedAt: new Date('2026-04-09T00:00:00.000Z'),
        };
        const findOne = jest.fn().mockResolvedValue(entity);

        const repository = new LocalesStoreRepository({
            findOne,
        } as never);

        const result = await repository.get('ru');

        expect(findOne).toHaveBeenCalledWith({
            where: { locale: 'ru' },
        });
        expect(result).toEqual({
            id: 7,
            locale: 'ru',
            data: { system: { ok: true } },
            version: 'md5:test',
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        });
        expect(result).not.toBe(entity);
    });

    it('upserts locale settings and returns a mapped store record', async () => {
        const entity = {
            id: '8',
            locale: 'en',
            data: { system: { ready: true } },
            version: 'md5:next',
            createdAt: new Date('2026-04-08T00:00:00.000Z'),
            updatedAt: new Date('2026-04-09T00:00:00.000Z'),
        };
        const upsert = jest.fn().mockResolvedValue(undefined);
        const findOneOrFail = jest.fn().mockResolvedValue(entity);

        const repository = new LocalesStoreRepository({
            upsert,
            findOneOrFail,
        } as never);

        const result = await repository.upsert(
            'en',
            { system: { ready: true } },
            'md5:next',
        );

        expect(upsert).toHaveBeenCalledWith(
            { locale: 'en', data: { system: { ready: true } }, version: 'md5:next' },
            ['locale'],
        );
        expect(findOneOrFail).toHaveBeenCalledWith({
            where: { locale: 'en' },
        });
        expect(result).toEqual({
            id: 8,
            locale: 'en',
            data: { system: { ready: true } },
            version: 'md5:next',
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        });
        expect(result).not.toBe(entity);
    });
});
