import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { loadSearchBaseAsset } from 'src/domain/search-base/common/utils/search-base-asset-loader.util';
import type {
    SearchBaseAssetItem,
    SearchBaseAssetPayload,
    SearchBaseAssetStep,
} from 'src/domain/search-base/common/types';

export interface FollowUpChip {
    stepId: string;
    label: string;
    query: string;
}

interface ResolvedStep {
    displayName: string;
    targetId: string;
}

interface IndexedAsset {
    locale: string;
    items: SearchBaseAssetItem[];
    itemById: Map<string, SearchBaseAssetItem>;
    stepById: Map<string, ResolvedStep>;
}

const FOLLOW_UP_LIMIT = 4;
const MIN_TOKEN_LENGTH = 3;

@Injectable()
export class FollowUpResolverService implements OnModuleInit {
    private readonly logger = new Logger(FollowUpResolverService.name);
    private readonly assets = new Map<string, IndexedAsset>();
    private fallbackLocale = 'ru';

    async onModuleInit(): Promise<void> {
        await this.loadAsset('mys/ru.json');
    }

    resolveByQuery(query: string, locale?: string): FollowUpChip[] {
        const asset = this.pickAsset(locale);
        if (!asset) return [];
        const item = this.findBestItem(asset, query);
        if (!item?.followUpStepIds?.length) return [];

        const chips: FollowUpChip[] = [];
        for (const stepId of item.followUpStepIds) {
            const step = asset.stepById.get(stepId);
            if (!step) continue;
            const target = asset.itemById.get(step.targetId);
            if (!target) continue;
            chips.push({
                stepId,
                label: step.displayName,
                query: target.queries[0] ?? target.title,
            });
            if (chips.length >= FOLLOW_UP_LIMIT) break;
        }
        return chips;
    }

    private pickAsset(locale?: string): IndexedAsset | undefined {
        if (locale) {
            const direct = this.assets.get(locale);
            if (direct) return direct;
        }
        return this.assets.get(this.fallbackLocale);
    }

    private findBestItem(
        asset: IndexedAsset,
        query: string,
    ): SearchBaseAssetItem | undefined {
        const normalized = this.normalize(query);
        if (!normalized) return undefined;
        const tokens = this.tokenize(normalized);

        let bestItem: SearchBaseAssetItem | undefined;
        let bestScore = 0;

        for (const item of asset.items) {
            const haystacks = [
                this.normalize(item.title),
                ...item.queries.map((q) => this.normalize(q)),
            ];

            let score = 0;
            for (const haystack of haystacks) {
                if (!haystack) continue;
                if (haystack === normalized) {
                    score = Math.max(score, 100);
                    continue;
                }
                if (haystack.includes(normalized) || normalized.includes(haystack)) {
                    score = Math.max(score, 60);
                }
                let tokenHits = 0;
                for (const token of tokens) {
                    if (haystack.includes(token)) tokenHits += 1;
                }
                if (tokenHits > 0) {
                    const tokenScore = (tokenHits / Math.max(tokens.length, 1)) * 50;
                    score = Math.max(score, tokenScore);
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestItem = item;
            }
        }

        return bestScore >= 30 ? bestItem : undefined;
    }

    private normalize(value: string): string {
        return value
            .toLocaleLowerCase('ru-RU')
            .replace(/ё/g, 'е')
            .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private tokenize(normalized: string): string[] {
        return normalized
            .split(' ')
            .filter((token) => token.length >= MIN_TOKEN_LENGTH);
    }

    private async loadAsset(relativePath: string): Promise<void> {
        try {
            const payload = await loadSearchBaseAsset(relativePath);
            this.indexAsset(payload);
            this.logger.log(
                `Loaded follow-up asset: locale=${payload.locale}, items=${payload.items.length}, steps=${payload.steps.length}`,
            );
        } catch (error) {
            this.logger.warn(
                `Failed to load follow-up asset "${relativePath}": ${(error as Error).message}`,
            );
        }
    }

    private indexAsset(payload: SearchBaseAssetPayload): void {
        const itemById = new Map<string, SearchBaseAssetItem>();
        for (const item of payload.items) {
            itemById.set(item.id, item);
        }
        const stepById = new Map<string, ResolvedStep>();
        for (const step of payload.steps as SearchBaseAssetStep[]) {
            stepById.set(step.id, {
                displayName: step.displayName,
                targetId: step.targetId,
            });
        }
        this.assets.set(payload.locale, {
            locale: payload.locale,
            items: payload.items,
            itemById,
            stepById,
        });
    }
}
