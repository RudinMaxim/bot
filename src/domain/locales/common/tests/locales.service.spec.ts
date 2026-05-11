import type { SecretsConfig } from 'src/infrastructure/config';

describe('LocalesService runtime fallback assets', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.dontMock('src/shared/runtime-assets');
    });

    it('loads locale fallback from runtime resources', async () => {
        const loadJsonResource = jest
            .fn()
            .mockResolvedValue({ system: { ok: true } });

        jest.doMock('src/shared/runtime-assets', () => ({
            loadJsonResource,
        }));

        const { LocalesService } = require('../../services/locales.service') as typeof import('../../services/locales.service');

        const service = new LocalesService(
            buildSecretsConfig(),
            buildLocalesCacheRepo() as never,
            buildLocalesStoreRepo() as never,
        );

        const locale = await service.getLocale('ru');

        expect(loadJsonResource).toHaveBeenCalledWith('locales/ru.json');
        expect(locale.data.system).toEqual({ ok: true });
        expect(locale.source).toBe('fallback');
    });

    it('memoizes repeated fallback resource loads across cache misses', async () => {
        const loadJsonResource = jest
            .fn()
            .mockResolvedValue({ system: { ok: true } });

        jest.doMock('src/shared/runtime-assets', () => ({
            loadJsonResource,
        }));

        const { LocalesService } = require('../../services/locales.service') as typeof import('../../services/locales.service');
        const cacheRepo = buildLocalesCacheRepo({
            get: jest.fn().mockResolvedValue(null),
        });

        const service = new LocalesService(
            buildSecretsConfig(),
            cacheRepo as never,
            buildLocalesStoreRepo() as never,
        );

        await service.getLocale('ru');
        await service.getLocale('ru');

        expect(loadJsonResource).toHaveBeenCalledTimes(1);
        expect(loadJsonResource).toHaveBeenCalledWith('locales/ru.json');
    });

    it('returns a safe fallback without caching when refresh lock contention persists', async () => {
        const loadJsonResource = jest
            .fn()
            .mockResolvedValue({ system: { safe: true } });

        jest.doMock('src/shared/runtime-assets', () => ({
            loadJsonResource,
        }));

        const { LocalesService } = require('../../services/locales.service') as typeof import('../../services/locales.service');
        const cacheRepo = buildLocalesCacheRepo({
            get: jest.fn().mockResolvedValue(null),
            acquireRefreshLock: jest.fn().mockResolvedValue(false),
            set: jest.fn().mockResolvedValue(undefined),
            releaseRefreshLock: jest.fn().mockResolvedValue(undefined),
        });

        const service = new LocalesService(
            buildSecretsConfig({ cmsTimeout: 0 }),
            cacheRepo as never,
            buildLocalesStoreRepo() as never,
        );

        const locale = await service.getLocale('ru');

        expect(locale.data.system).toEqual({ safe: true });
        expect(locale.source).toBe('fallback');
        expect(cacheRepo.acquireRefreshLock).toHaveBeenCalledTimes(2);
        expect(cacheRepo.set).not.toHaveBeenCalled();
        expect(cacheRepo.releaseRefreshLock).not.toHaveBeenCalled();
    });

    it('returns an empty fallback when locale resource is missing', async () => {
        const loadJsonResource = jest
            .fn()
            .mockRejectedValue(
                new Error('Resource asset not found: locales/ru.json'),
            );

        jest.doMock('src/shared/runtime-assets', () => ({
            loadJsonResource,
        }));

        const { LocalesService } = require('../../services/locales.service') as typeof import('../../services/locales.service');

        const service = new LocalesService(
            buildSecretsConfig(),
            buildLocalesCacheRepo() as never,
            buildLocalesStoreRepo() as never,
        );

        const locale = await service.getLocale('ru');

        expect(locale.data).toEqual({});
        expect(locale.source).toBe('fallback');
    });
});

function buildSecretsConfig(
    overrides: Partial<SecretsConfig['locales']> = {},
): SecretsConfig {
    return {
        locales: {
            cacheTtl: 60,
            cmsTimeout: 1000,
            ...overrides,
        },
    } as unknown as SecretsConfig;
}

function buildLocalesCacheRepo(
    overrides: Record<string, jest.Mock> = {},
) {
    return {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        acquireRefreshLock: jest.fn().mockResolvedValue(true),
        releaseRefreshLock: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function buildLocalesStoreRepo() {
    return {
        get: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
    };
}
