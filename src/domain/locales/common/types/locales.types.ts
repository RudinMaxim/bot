export type LocaleData = Record<string, unknown>;

export type LocaleSource = 'cache' | 'fallback' | 'postgres';

export interface LocaleCacheEntry {
    locale: string;
    version: string;
    lastModified: string;
    data: LocaleData;
}

export interface LocaleResponse extends LocaleCacheEntry {
    source: LocaleSource;
}

export interface LocaleListResponse {
    defaultLocale: string;
    availableLocales: string[];
}

export interface LocaleSettingsPayload {
    locale: string;
    version: string;
    lastModified: string;
    source: LocaleSource;
    settings: LocaleData;
}

export interface LocaleSettingsUpdatePayload {
    settings: LocaleData;
}
