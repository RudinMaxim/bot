import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SecretsConfig } from 'src/infrastructure/config';
import { RedisService } from 'src/infrastructure/redis';
import type { SearchBaseItemInput } from '../common/types';
import {
    SEARCH_BASE_REFRESH_LOCK_PREFIX,
    SEARCH_BASE_REFRESH_MODE,
    type SearchBaseRefreshMode,
} from '../common/constants';
import { SearchBaseCatalogRepository } from '../repository';
import type { SearchBaseCatalogRecord } from '../repository/search-base.repository';
import { EmbeddingService } from './embedding.service';

interface SearchBaseRefreshOptions {
    locale?: string;
    force?: boolean;
}

@Injectable()
export class SearchBaseRefreshService {
    private readonly logger = new Logger(SearchBaseRefreshService.name);
    private readonly lockPrefix = SEARCH_BASE_REFRESH_LOCK_PREFIX;
    private readonly lockTtlSeconds = 55 * 60;
    private readonly batchSize: number;
    private isRunning = false;

    constructor(
        private readonly config: SecretsConfig,
        private readonly redisService: RedisService,
        private readonly embeddingService: EmbeddingService,
        private readonly searchBaseCatalogRepo: SearchBaseCatalogRepository,
    ) {
        const baseBatch = Math.max(
            1,
            this.config.embedding.vectorizationBatchSize,
        );
        this.batchSize = Math.min(baseBatch * 20, 1000);
    }

    @Cron(CronExpression.EVERY_HOUR)
    async refreshSearchBaseEmbeddings(
        options: SearchBaseRefreshOptions = {},
    ): Promise<void> {
        const locale = options.locale?.trim() || undefined;
        const force = options.force === true;
        const mode: SearchBaseRefreshMode = force
            ? SEARCH_BASE_REFRESH_MODE.FULL
            : SEARCH_BASE_REFRESH_MODE.PENDING;

        if (this.isRunning) {
            this.logger.warn('Search-base refresh already running, skipping.');
            return;
        }

        const lockKey = this.buildLockKey(locale);
        const lockValue = `${process.pid}:${Date.now()}`;
        let distributedLockAcquired = false;

        try {
            distributedLockAcquired = await this.redisService.setIfNotExists(
                lockKey,
                lockValue,
                this.lockTtlSeconds,
            );
            if (!distributedLockAcquired) {
                this.logger.warn(
                    `Search-base refresh already running in another instance, skipping. key=${lockKey}`,
                );
                return;
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to acquire distributed refresh lock (${lockKey}): ${message}. Refresh skipped.`,
            );
            return;
        }

        this.isRunning = true;

        try {
            if (force) {
                const deletedVectors =
                    await this.embeddingService.deleteSearchBaseVectors({
                        locale,
                    });
                this.logger.log(
                    `Search-base refresh pre-cleanup (${mode}${locale ? `, locale=${locale}` : ''}): deletedVectors=${deletedVectors}`,
                );
            }

            let totalCreated = 0;
            let totalUpdated = 0;
            let totalFailed = 0;
            let totalCandidates = 0;
            let afterId = 0;

            while (true) {
                const candidates =
                    await this.searchBaseCatalogRepo.listForEmbeddingRefresh(
                        this.batchSize,
                        {
                            locale,
                            force,
                            afterId: force ? afterId : undefined,
                        },
                    );

                if (!candidates.length) {
                    break;
                }

                totalCandidates += candidates.length;
                if (force) {
                    afterId = candidates[candidates.length - 1]?.id || afterId;
                }

                const grouped = this.groupByLocale(candidates);
                for (const [recordLocale, records] of grouped) {
                    try {
                        const payload = {
                            locale: recordLocale,
                            data: records.map((record) =>
                                this.mapToInput(record),
                            ),
                            skipIfUnchanged: false,
                        };
                        const result =
                            await this.embeddingService.upsertSearchBase(
                                payload,
                            );

                        totalCreated += result.created;
                        totalUpdated += result.updated;
                        totalFailed += result.failed;

                        this.logger.log(
                            `Search-base refresh [${recordLocale}]: ${records.length} items → ` +
                                `created=${result.created} updated=${result.updated} ` +
                                `skipped=${result.skipped} failed=${result.failed}`,
                        );
                    } catch (error) {
                        totalFailed += records.length;
                        const message =
                            error instanceof Error
                                ? error.message
                                : String(error);
                        this.logger.error(
                            `Search-base refresh failed for locale="${recordLocale}" (${records.length} items): ${message}`,
                        );
                    }
                }

                if (!force || candidates.length < this.batchSize) {
                    break;
                }
            }

            if (totalCandidates === 0) {
                this.logger.debug(
                    `Search-base refresh (${mode}): no items to process.`,
                );
                return;
            }

            this.logger.log(
                `Search-base refresh completed (${mode}${locale ? `, locale=${locale}` : ''}): ` +
                    `${totalCandidates} items (created=${totalCreated} updated=${totalUpdated} failed=${totalFailed})`,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(`Search-base refresh failed: ${message}`);
        } finally {
            this.isRunning = false;
            if (distributedLockAcquired) {
                await this.releaseLock(lockKey, lockValue);
            }
        }
    }

    private buildLockKey(locale?: string): string {
        return `${this.lockPrefix}:${locale || 'all'}`;
    }

    private async releaseLock(
        lockKey: string,
        lockValue: string,
    ): Promise<void> {
        try {
            const currentValue = await this.redisService.get<string>(lockKey);
            if (currentValue !== lockValue) {
                return;
            }
            await this.redisService.del(lockKey);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `Failed to release distributed refresh lock (${lockKey}): ${message}`,
            );
        }
    }

    private groupByLocale(
        items: SearchBaseCatalogRecord[],
    ): Map<string, SearchBaseCatalogRecord[]> {
        const grouped = new Map<string, SearchBaseCatalogRecord[]>();
        for (const item of items) {
            const locale = item.locale?.trim();
            if (!locale) {
                this.logger.warn(
                    `Search-base refresh skipped item ${item.documentId}: empty locale`,
                );
                continue;
            }
            if (!grouped.has(locale)) {
                grouped.set(locale, []);
            }
            grouped.get(locale)!.push(item);
        }
        return grouped;
    }

    private mapToInput(record: SearchBaseCatalogRecord): SearchBaseItemInput {
        return {
            id: record.documentId,
            title: record.title,
            description: record.description,
            content: record.content,
            url: record.url,
            source: record.source,
            updatedAt:
                record.sourceUpdatedAt ||
                this.formatDate(record.updatedAt) ||
                this.formatDate(record.createdAt),
            order: record.order,
        };
    }

    private formatDate(value?: Date): string | undefined {
        if (!value) return undefined;
        const parsed = value instanceof Date ? value : new Date(value);
        if (isNaN(parsed.getTime())) {
            return undefined;
        }
        return parsed.toISOString();
    }
}
