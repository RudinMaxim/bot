type Dictionary = Record<string, unknown>;

const dictionaries: Record<string, Dictionary> = {};
export type Locale = string;
export const DEFAULT_LOCALE = 'ru';

export function setLocaleDictionary(
    locale: string,
    dictionary: Dictionary,
): void {
    dictionaries[locale] = dictionary;
}

export function hasLocaleDictionary(locale: string): boolean {
    return Boolean(dictionaries[locale]);
}

export function resolveLocale(raw?: unknown): Locale {
    if (typeof raw !== 'string') return DEFAULT_LOCALE;

    const normalized = raw.trim().toLowerCase();
    if (!normalized) return DEFAULT_LOCALE;

    const base = normalized.split('-')[0];
    if (base === 'ru' || base === 'en') return base;

    if (normalized.startsWith('ru')) return 'ru';
    if (normalized.startsWith('en')) return 'en';
    return DEFAULT_LOCALE;
}

function resolvePath(path: string, dictionary: Dictionary): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
        if (!acc || typeof acc !== 'object') return undefined;
        return (acc as Dictionary)[key];
    }, dictionary);
}

function getDictionary(locale?: Locale): Dictionary {
    const resolved = locale ?? DEFAULT_LOCALE;
    return dictionaries[resolved] ?? dictionaries[DEFAULT_LOCALE] ?? {};
}

export function t(
    path: string,
    params?: Record<string, string | number | boolean | null | undefined>,
    locale?: Locale,
): string {
    const value = resolvePath(path, getDictionary(locale));
    if (typeof value !== 'string') return path;
    return params ? formatText(value, params) : value;
}

export function getI18nValue(path: string, locale?: Locale): unknown {
    return resolvePath(path, getDictionary(locale));
}

export function formatText(
    template: string,
    vars: Record<string, string | number | boolean | null | undefined> = {},
): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
        const raw = vars[key];
        return raw === null || raw === undefined ? '' : String(raw);
    });
}
