import { Logger } from '@nestjs/common';
import { DEFAULT_LOCALE, getI18nValue, resolveLocale } from 'src/shared/utils';
import { extractErrorMessage } from './ai.utils';

export type SupportedLocale = 'ru' | 'en';

const logger = new Logger('LocaleUtils');

/**
 * Resolve locale to supported value ('ru' | 'en').
 */
export function toSupportedLocale(raw?: unknown): SupportedLocale {
    const normalized = resolveLocale(raw);
    return normalized === 'en' ? 'en' : 'ru';
}

export interface LocalesWarmupService {
    getLocale(locale: string): Promise<unknown>;
}

/**
 * Validate, warm up locale via service, and resolve to supported locale.
 * Replaces 4 duplicated ensureLocale/resolveSupportedLocale implementations.
 *
 * Pass `preResolved` when the caller already performed the async warmup
 * (e.g. orchestrator resolved locale before building agent input) — skips
 * the IO call entirely and returns immediately.
 */
export async function ensureLocale(
    localesService: LocalesWarmupService,
    raw: string = DEFAULT_LOCALE,
    logContext?: string,
    preResolved?: string,
): Promise<SupportedLocale> {
    if (preResolved) {
        return toSupportedLocale(preResolved);
    }

    if (raw.trim()) {
        try {
            await localesService.getLocale(raw.trim());
        } catch (error) {
            logger.warn(
                `[${logContext ?? 'unknown'}] Locales warmup failed: ${extractErrorMessage(error)}`,
            );
        }
    }

    return toSupportedLocale(raw.trim());
}

/**
 * Fetch a localized string array from i18n, filter non-strings,
 * with fallback to DEFAULT_LOCALE. Returns lowercased values.
 */
export function getLocalizedStringArray(
    path: string,
    locale: SupportedLocale | string,
): string[] {
    const filterStrings = (arr: unknown[]): string[] =>
        arr.filter((item): item is string => typeof item === 'string');

    const raw = getI18nValue(path, locale);
    const values = Array.isArray(raw) ? filterStrings(raw) : [];

    if (values.length === 0 && locale !== DEFAULT_LOCALE) {
        const fallbackRaw = getI18nValue(path, DEFAULT_LOCALE);
        return Array.isArray(fallbackRaw)
            ? filterStrings(fallbackRaw).map((v) => v.toLowerCase())
            : [];
    }

    return values.map((v) => v.toLowerCase());
}
