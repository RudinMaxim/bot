import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SecretsConfig } from 'src/infrastructure/config';
import { loadJsonResource } from 'src/shared/runtime-assets';
import { DEFAULT_LOCALE, setLocaleDictionary } from 'src/shared/utils/texts';
import { hashed, sleep } from 'src/shared/utils';
import {
    LocaleCacheEntry,
    LocaleData,
    LocaleResponse,
    LocaleSource,
} from '../common/types';
import {
    InvalidLocaleError,
    LocaleNotFoundError,
    LocalePayloadError,
} from '../common/errors';
import { LocalesCacheRepository, LocalesStoreRepository } from '../repository';
import {
    DEFAULT_SUPPORTED_LOCALES,
    LOCALE_CODE_REGEX,
} from '../common/constants';
import { Cron, CronExpression } from '@nestjs/schedule';

const FALLBACK_LOCALE_RESOURCE_PATHS: Record<string, string> = {
    ru: 'locales/ru.json',
    en: 'locales/en.json',
};

const fallbackLocalePromises = new Map<string, Promise<LocaleData>>();

function resolveFallbackLocalePath(locale?: string): string {
    const normalized = locale?.trim().toLowerCase().split('-')[0];

    return (
        FALLBACK_LOCALE_RESOURCE_PATHS[normalized || DEFAULT_LOCALE] ??
        FALLBACK_LOCALE_RESOURCE_PATHS[DEFAULT_LOCALE]
    );
}

function loadFallbackLocale(locale?: string): Promise<LocaleData> {
    const resourcePath = resolveFallbackLocalePath(locale);
    const cached = fallbackLocalePromises.get(resourcePath);
    if (cached) {
        return cached;
    }

    const pending = loadJsonResource<LocaleData>(resourcePath);
    fallbackLocalePromises.set(resourcePath, pending);

    return pending;
}

@Injectable()
export class LocalesService implements OnModuleInit {
    private readonly logger = new Logger(LocalesService.name);
    private readonly cacheTtl: number;
    private readonly supportedLocales: string[];
    private readonly refreshLockTtlSeconds: number;
    private readonly refreshWaitMs: number;

    constructor(
        private readonly secretsConfig: SecretsConfig,
        private readonly localesCacheRepo: LocalesCacheRepository,
        private readonly localesStoreRepo: LocalesStoreRepository,
    ) {
        this.cacheTtl = this.secretsConfig.locales.cacheTtl;
        this.supportedLocales = [...DEFAULT_SUPPORTED_LOCALES];
        const localesTimeout = this.secretsConfig.locales.cmsTimeout;
        this.refreshLockTtlSeconds = Math.max(
            5,
            Math.ceil(localesTimeout / 1000),
        );
        this.refreshWaitMs = Math.min(localesTimeout, 2000);
    }

    async onModuleInit(): Promise<void> {
        try {
            await this.getLocale(DEFAULT_LOCALE);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Locales warmup failed: ${message}`);
        }
    }

    async getLocale(locale: string): Promise<LocaleResponse> {
        if (!this.isLocaleValid(locale)) {
            throw new InvalidLocaleError();
        }
        const normalized = this.normalizeLocale(locale);
        const cached = await this.getCachedLocale(normalized);
        if (cached) {
            this.updateDictionary(normalized, cached.data);
            return { ...cached, source: 'cache' };
        }

        return this.refreshLocale(normalized, 'miss');
    }

    async updateLocaleSettings(
        locale: string,
        settings: LocaleData,
    ): Promise<LocaleResponse> {
        if (!this.isLocaleValid(locale)) {
            throw new InvalidLocaleError();
        }
        if (!this.isPlainObject(settings)) {
            throw new LocalePayloadError('Settings must be an object');
        }

        const normalized = this.normalizeLocale(locale);
        const fallback = await this.getFallbackLocale(normalized);
        const merged = this.mergeLocaleData(fallback, settings);
        const version = this.computeVersion(merged);
        const lastModified = await this.writeLocaleStore(
            normalized,
            merged,
            version,
        );
        const entry: LocaleCacheEntry = {
            locale: normalized,
            version,
            lastModified,
            data: merged,
        };

        await this.setCachedLocale(normalized, entry);
        this.updateDictionary(normalized, merged);

        return { ...entry, source: 'postgres' };
    }

    getCacheTtl(): number {
        return this.cacheTtl;
    }

    isLocaleValid(locale: string): boolean {
        if (!locale || typeof locale !== 'string') return false;
        if (!LOCALE_CODE_REGEX.test(locale)) return false;
        const base = locale.toLowerCase().split('-')[0];
        return this.supportedLocales.includes(base);
    }

    async getLocalesSummary(): Promise<{
        defaultLocale: string;
        availableLocales: string[];
    }> {
        const available: string[] = [];

        for (const locale of this.supportedLocales) {
            try {
                await this.getLocale(locale);
                available.push(locale);
            } catch (error) {
                if (error instanceof LocaleNotFoundError) {
                    continue;
                }
                const message =
                    error instanceof Error ? error.message : 'Unknown error';
                this.logger.warn(
                    `Locales summary warmup failed for ${locale}: ${message}`,
                );
            }
        }

        return {
            defaultLocale: DEFAULT_LOCALE,
            availableLocales: Array.from(new Set(available)).sort(),
        };
    }

    private async refreshLocale(
        locale: string,
        reason: 'miss' | 'cron',
    ): Promise<LocaleResponse> {
        let lockAcquired = await this.localesCacheRepo.acquireRefreshLock(
            locale,
            this.refreshLockTtlSeconds,
        );
        if (!lockAcquired) {
            const cached = await this.waitForCachedLocale(locale);
            if (cached) {
                this.updateDictionary(locale, cached.data);
                return { ...cached, source: 'cache' };
            }
            lockAcquired = await this.localesCacheRepo.acquireRefreshLock(
                locale,
                this.refreshLockTtlSeconds,
            );
            if (!lockAcquired) {
                const cachedAfterBackoff = await this.getCachedLocale(locale);
                if (cachedAfterBackoff) {
                    this.updateDictionary(locale, cachedAfterBackoff.data);
                    return { ...cachedAfterBackoff, source: 'cache' };
                }

                return this.buildFallbackResponse(locale, reason, {
                    skipCacheWrite: true,
                });
            }
        }

        try {
            const storePayload = await this.readLocaleStore(locale);
            if (
                !storePayload &&
                locale !== DEFAULT_LOCALE &&
                !this.hasFallbackLocale(locale)
            ) {
                throw new LocaleNotFoundError(locale);
            }

            if (!storePayload) {
                return this.buildFallbackResponse(locale, reason);
            }

            const fallback = await this.getFallbackLocale(locale);
            const merged = this.mergeLocaleData(fallback, storePayload.data);
            const version = this.computeVersion(merged);
            const lastModified = storePayload.lastModified;
            const source: LocaleSource = 'postgres';

            const entry: LocaleCacheEntry = {
                locale,
                version,
                lastModified,
                data: merged,
            };

            await this.setCachedLocale(locale, entry);
            this.updateDictionary(locale, merged);
            return { ...entry, source };
        } finally {
            if (lockAcquired) {
                await this.localesCacheRepo.releaseRefreshLock(locale);
            }
        }
    }

    private async buildFallbackResponse(
        locale: string,
        reason: 'miss' | 'cron',
        options: { skipCacheWrite?: boolean } = {},
    ): Promise<LocaleResponse> {
        if (locale !== DEFAULT_LOCALE && !this.hasFallbackLocale(locale)) {
            throw new LocaleNotFoundError(locale);
        }

        const fallback = await this.getFallbackLocale(locale);
        const entry: LocaleCacheEntry = {
            locale,
            version: this.computeVersion(fallback),
            lastModified: new Date().toISOString(),
            data: fallback,
        };

        if (!options.skipCacheWrite) {
            await this.setCachedLocale(locale, entry);
        }

        if (reason === 'miss') {
            const suffix = options.skipCacheWrite
                ? ' Returning fallback without taking refresh lock.'
                : ' Using fallback data.';
            this.logger.warn(`Locales cache miss for ${locale}.${suffix}`);
        }

        this.updateDictionary(locale, fallback);

        return { ...entry, source: 'fallback' };
    }

    @Cron(CronExpression.EVERY_HOUR)
    async handleLocalesRefresh(): Promise<void> {
        try {
            for (const locale of this.supportedLocales) {
                try {
                    await this.refreshLocale(locale, 'cron');
                } catch (error) {
                    if (error instanceof LocaleNotFoundError) {
                        await this.localesCacheRepo.delete(locale);
                    }
                    const message =
                        error instanceof Error
                            ? error.message
                            : 'Unknown error';
                    this.logger.warn(
                        `Locales refresh failed for ${locale}: ${message}`,
                    );
                }
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Locales cron refresh failed: ${message}`);
        }
    }

    private async waitForCachedLocale(
        locale: string,
    ): Promise<LocaleCacheEntry | null> {
        const start = Date.now();
        while (Date.now() - start < this.refreshWaitMs) {
            const cached = await this.getCachedLocale(locale);
            if (cached) return cached;
            await sleep(200);
        }
        return null;
    }

    private async getCachedLocale(
        locale: string,
    ): Promise<LocaleCacheEntry | null> {
        return this.localesCacheRepo.get(locale);
    }

    private async setCachedLocale(
        locale: string,
        entry: LocaleCacheEntry,
    ): Promise<void> {
        await this.localesCacheRepo.set(locale, entry, this.cacheTtl);
    }

    private async readLocaleStore(
        locale: string,
    ): Promise<{ data: LocaleData; lastModified: string } | null> {
        const record = await this.localesStoreRepo.get(locale);
        if (!record) return null;
        const lastModified =
            record.updatedAt?.toISOString() ||
            record.createdAt?.toISOString() ||
            new Date().toISOString();
        return {
            data: record.data as LocaleData,
            lastModified,
        };
    }

    private async writeLocaleStore(
        locale: string,
        settings: LocaleData,
        version: string,
    ): Promise<string> {
        const record = await this.localesStoreRepo.upsert(
            locale,
            settings,
            version,
        );
        return (
            record.updatedAt?.toISOString() ||
            record.createdAt?.toISOString() ||
            new Date().toISOString()
        );
    }

    private mergeLocaleData(
        fallback: LocaleData,
        incoming?: LocaleData | null,
    ): LocaleData {
        if (!incoming || !this.isPlainObject(incoming)) {
            return fallback;
        }
        return this.deepMerge(fallback, incoming);
    }

    private deepMerge(base: LocaleData, override: LocaleData): LocaleData {
        const result: LocaleData = { ...base };

        for (const [key, value] of Object.entries(override)) {
            if (value === undefined || value === null) {
                continue;
            }

            const baseValue = base[key];
            if (this.isPlainObject(baseValue) && this.isPlainObject(value)) {
                result[key] = this.deepMerge(baseValue, value);
                continue;
            }

            result[key] = value;
        }

        return result;
    }

    private isPlainObject(value: unknown): value is LocaleData {
        return (
            typeof value === 'object' && value !== null && !Array.isArray(value)
        );
    }

    private computeVersion(data: LocaleData): string {
        return `md5:${hashed(JSON.stringify(data))}`;
    }

    private hasFallbackLocale(locale?: string): boolean {
        const normalized = this.normalizeLocale(locale);
        return Boolean(FALLBACK_LOCALE_RESOURCE_PATHS[normalized]);
    }

    private async getFallbackLocale(locale?: string): Promise<LocaleData> {
        return loadFallbackLocale(this.normalizeLocale(locale));
    }

    private updateDictionary(locale: string, data: LocaleData): void {
        setLocaleDictionary(locale, data);
    }

    private normalizeLocale(locale?: string): string {
        if (!locale || typeof locale !== 'string') return DEFAULT_LOCALE;
        const normalized = locale.trim().toLowerCase();
        if (!normalized) return DEFAULT_LOCALE;
        return normalized.split('-')[0] || DEFAULT_LOCALE;
    }
}
