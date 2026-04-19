import type { LocaleData } from 'src/domain/locales/common/types';
import type { SearchBaseAssetPayload } from 'src/domain/search-base/common/types';
import { loadSearchBaseAsset } from 'src/domain/search-base/common/utils';
import { loadJsonResource } from 'src/shared/runtime-assets';

export interface BootstrapAssets {
    locales: {
        ru: LocaleData;
        en: LocaleData;
    };
    searchBase: {
        mys: {
            ru: SearchBaseAssetPayload;
        };
    };
}

export interface BootstrapAssetLoaders {
    loadJsonResource?: <T>(relativePath: string) => Promise<T>;
    loadSearchBaseAsset?: (
        relativePath: string,
    ) => Promise<SearchBaseAssetPayload>;
}

export async function loadBootstrapAssets(
    loaders: BootstrapAssetLoaders = {},
): Promise<BootstrapAssets> {
    const loadLocaleResource =
        loaders.loadJsonResource ?? loadJsonResource;
    const loadSearchBaseResource =
        loaders.loadSearchBaseAsset ?? loadSearchBaseAsset;

    const [ruLocale, enLocale, mysRuSearchBase] = await Promise.all([
        loadLocaleResource<LocaleData>('locales/ru.json'),
        loadLocaleResource<LocaleData>('locales/en.json'),
        loadSearchBaseResource('mys/ru.json'),
    ]);

    return {
        locales: {
            ru: ruLocale,
            en: enLocale,
        },
        searchBase: {
            mys: {
                ru: mysRuSearchBase,
            },
        },
    };
}
