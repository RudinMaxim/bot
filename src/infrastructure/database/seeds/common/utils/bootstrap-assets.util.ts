import type { LocaleData } from 'src/domain/locales/common/types';
import type { SearchBaseAssetPayload } from 'src/domain/search-base/common/types';
import { loadSearchBaseAsset } from 'src/domain/search-base/common/utils';
import { loadJsonResource } from 'src/shared/runtime-assets';

export interface BootstrapAssets {
    locales: Partial<Record<'ru' | 'en', LocaleData>>;
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
        loadOptionalLocaleResource(loadLocaleResource, 'locales/ru.json'),
        loadOptionalLocaleResource(loadLocaleResource, 'locales/en.json'),
        loadSearchBaseResource('mys/ru.json'),
    ]);

    return {
        locales: buildLocalesPayload({ ru: ruLocale, en: enLocale }),
        searchBase: {
            mys: {
                ru: mysRuSearchBase,
            },
        },
    };
}

async function loadOptionalLocaleResource(
    loader: <T>(relativePath: string) => Promise<T>,
    relativePath: string,
): Promise<LocaleData | undefined> {
    try {
        return await loader<LocaleData>(relativePath);
    } catch (error) {
        if (isResourceAssetNotFound(error)) {
            return undefined;
        }
        throw error;
    }
}

function buildLocalesPayload(
    locales: Partial<Record<'ru' | 'en', LocaleData | undefined>>,
): Partial<Record<'ru' | 'en', LocaleData>> {
    return Object.fromEntries(
        Object.entries(locales).filter((entry): entry is [string, LocaleData] =>
            Boolean(entry[1]),
        ),
    ) as Partial<Record<'ru' | 'en', LocaleData>>;
}

function isResourceAssetNotFound(error: unknown): boolean {
    return (
        error instanceof Error &&
        error.message.startsWith('Resource asset not found:')
    );
}
