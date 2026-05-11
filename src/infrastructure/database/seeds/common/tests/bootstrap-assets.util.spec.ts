import * as fs from 'fs/promises';
import * as path from 'path';

import type { LocaleData } from 'src/domain/locales/common/types';
import type { SearchBaseAssetPayload } from 'src/domain/search-base/common/types';

import {
    loadBootstrapAssets,
    type BootstrapAssetLoaders,
} from '../utils/bootstrap-assets.util';

type TestLocaleData = LocaleData & {
    system: {
        locale: string;
    };
};

function buildSearchBaseAssetFixture(): SearchBaseAssetPayload {
    return {
        dataset: 'mys',
        locale: 'ru',
        version: 1,
        steps: [],
        items: [
            {
                id: 'object_overview-001',
                category: 'object_overview',
                title: 'What is this project?',
                queries: ['What is this project?'],
                answer: 'A runtime asset test payload.',
                source: 'test',
                order: 1,
            },
        ],
    };
}

describe('bootstrap-assets.util', () => {
    it('does not require legacy infrastructure seed json files', async () => {
        const legacyPaths = [
            path.resolve(
                process.cwd(),
                'src/infrastructure/database/seeds/locales/ru.json',
            ),
            path.resolve(
                process.cwd(),
                'src/infrastructure/database/seeds/locales/en.json',
            ),
            path.resolve(
                process.cwd(),
                'src/infrastructure/database/seeds/search-base.ru.json',
            ),
            path.resolve(
                process.cwd(),
                'src/infrastructure/database/seeds/search-base.shared.json',
            ),
        ];

        for (const legacyPath of legacyPaths) {
            await expect(fs.access(legacyPath)).rejects.toThrow();
        }
    });

    it('loads search-base assets from runtime resources without requiring locales', async () => {
        const assets = await loadBootstrapAssets();

        expect(assets.locales).toBeDefined();
        expect(assets.searchBase.mys.ru).toMatchObject({
            dataset: expect.any(String),
            locale: 'ru',
            version: expect.any(Number),
        });
        expect(assets.searchBase.mys.ru.items.length).toBeGreaterThan(0);
    });

    it('loads bootstrap assets through shared resource loaders', async () => {
        const localeFixtures: Record<string, TestLocaleData> = {
            'locales/ru.json': { system: { locale: 'ru' } },
            'locales/en.json': { system: { locale: 'en' } },
        };
        const loadJsonResourceMock = jest.fn(
            async (relativePath: string): Promise<TestLocaleData> =>
                localeFixtures[relativePath],
        );
        const loadJsonResource: BootstrapAssetLoaders['loadJsonResource'] =
            async <T>(relativePath: string): Promise<T> =>
                (await loadJsonResourceMock(relativePath)) as T;

        const loadSearchBaseAsset = jest
            .fn<Promise<SearchBaseAssetPayload>, [string]>()
            .mockResolvedValue(buildSearchBaseAssetFixture());

        const assets = await loadBootstrapAssets({
            loadJsonResource,
            loadSearchBaseAsset,
        });

        expect(loadJsonResourceMock).toHaveBeenNthCalledWith(
            1,
            'locales/ru.json',
        );
        expect(loadJsonResourceMock).toHaveBeenNthCalledWith(
            2,
            'locales/en.json',
        );
        expect(loadSearchBaseAsset).toHaveBeenCalledWith('mys/ru.json');
        expect((assets.locales.ru as TestLocaleData).system.locale).toBe('ru');
        expect((assets.locales.en as TestLocaleData).system.locale).toBe('en');
        expect(assets.searchBase.mys.ru.items).toHaveLength(1);
    });

    it('does not require locale resources for bootstrap seed', async () => {
        const loadJsonResource: BootstrapAssetLoaders['loadJsonResource'] =
            async () => {
                throw new Error('Resource asset not found: locales/ru.json');
            };

        const loadSearchBaseAsset = jest
            .fn<Promise<SearchBaseAssetPayload>, [string]>()
            .mockResolvedValue(buildSearchBaseAssetFixture());

        const assets = await loadBootstrapAssets({
            loadJsonResource,
            loadSearchBaseAsset,
        });

        expect(assets.locales).toEqual({});
        expect(assets.searchBase.mys.ru.items).toHaveLength(1);
    });
});
